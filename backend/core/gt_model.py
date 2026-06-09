"""
gt_model.py
===========
Gas turbine thermodynamic model for the SGT5-2000E at Sirajganj.

Two solver modes
----------------
Mode 1 — Measured GT output → heat rate, efficiency, deviations
  Inputs : ambient conditions + measured GT gross output [MW]
  Outputs: heat rate (LHV & HHV), efficiency, expected fuel flow, deviations

Mode 2 — Fuel input → expected GT output
  Inputs : ambient conditions + fuel flow [kg/s] + LHV [kJ/kg] + HHV [kJ/kg]
  Outputs: expected GT gross output, net busbar, heat rate (LHV & HHV), efficiency

Both modes also return the full thermodynamic state at every cycle node:
  State 1 : compressor inlet
  State 3 : compressor outlet
  State 4 : turbine inlet  (back-calculated from energy balance)
  State 5 : turbine outlet (= exhaust, ϑTII)
"""

import math
import numpy as np
from scipy.interpolate import interp1d

from config.sirajganj import (
    OEM_CURVE_GAS, OEM_CURVE_OIL,
    P_AMB_0, DP_INLET_ISO,
    P_EXC,
    PR_DESIGN, ETA_C_IS_DESIGN, GAMMA_AIR, CP_AIR,
    ETA_T_IS_DESIGN, GAMMA_GAS_HOT, CP_GAS_HOT,
    HHV_LHV_RATIO_GAS, HHV_LHV_RATIO_OIL,
    LHV_GAS,
    FILTER_STAGES,
)
from core.properties import (
    moist_air_density,
    moist_air_humidity_ratio,
    air_cp_gamma,
    air_isentropic_temperature,
    exhaust_cp,
)


# ---------------------------------------------------------------------------
# OEM curve interpolators — built once at module load
# ---------------------------------------------------------------------------

def _build_interpolator(curve_dict: dict):
    """Build linear interpolators for P_GT and ϑTII from an OEM curve dict."""
    T_pts  = sorted(curve_dict.keys())
    P_pts  = [curve_dict[t][0] for t in T_pts]
    TII_pts = [curve_dict[t][1] for t in T_pts]
    f_P   = interp1d(T_pts, P_pts,   kind="linear", fill_value="extrapolate")
    f_TII = interp1d(T_pts, TII_pts, kind="linear", fill_value="extrapolate")
    return f_P, f_TII


_f_P_gas,  _f_TII_gas  = _build_interpolator(OEM_CURVE_GAS)
_f_P_oil,  _f_TII_oil  = _build_interpolator(OEM_CURVE_OIL)


# ---------------------------------------------------------------------------
# Filter pressure drop
# ---------------------------------------------------------------------------

def filter_delta_p(
    hours_coalescer: float = 0.0,
    hours_prefilter: float = 0.0,
    hours_finefilter: float = 0.0,
) -> dict:
    """
    Calculate inlet filter ΔP from operating hours since last replacement.

    Parameters
    ----------
    hours_coalescer  : hours since last coalescer replacement
    hours_prefilter  : hours since last pre-filter replacement
    hours_finefilter : hours since last fine-filter replacement

    Returns
    -------
    dict with keys:
      dp_coalescer_Pa, dp_prefilter_Pa, dp_finefilter_Pa,
      dp_total_Pa, dp_total_hPa
    """
    results = {}
    total_Pa = 0.0
    for stage, h in [
        ("coalescer",  hours_coalescer),
        ("prefilter",  hours_prefilter),
        ("finefilter", hours_finefilter),
    ]:
        d   = FILTER_STAGES[stage]
        dp  = d["dp_initial_Pa"] + (d["dp_final_Pa"] - d["dp_initial_Pa"]) * \
              min(h / d["life_hours"], 1.0)
        results[f"dp_{stage}_Pa"] = dp
        total_Pa += dp
    results["dp_total_Pa"]  = total_Pa
    results["dp_total_hPa"] = total_Pa / 100.0
    return results


# ---------------------------------------------------------------------------
# OEM curve lookup — P_GT and ϑTII at given T_CI
# ---------------------------------------------------------------------------

def oem_curve_lookup(T_CI: float, fuel: str = "gas") -> tuple[float, float]:
    """
    Return (P_GT_nominal [MW], ϑTII [°C]) from OEM curve at T_CI.

    Parameters
    ----------
    T_CI : compressor inlet temperature [°C]
    fuel : 'gas' or 'oil'
    """
    if fuel == "gas":
        P_GT  = float(_f_P_gas(T_CI))
        T_TII = float(_f_TII_gas(T_CI))
    elif fuel == "oil":
        P_GT  = float(_f_P_oil(T_CI))
        T_TII = float(_f_TII_oil(T_CI))
    else:
        raise ValueError(f"fuel must be 'gas' or 'oil', got '{fuel}'")
    return P_GT, T_TII


# ---------------------------------------------------------------------------
# Pressure-corrected measured setting power
# ---------------------------------------------------------------------------

def pressure_corrected_output(
    P_GT_nominal: float, P_amb: float
) -> float:
    """
    Return pressure-corrected measured setting power P_GTM [MW].

    P_GTM = P_GT(T_CI) × (P_amb / P_amb,0) + P_EXC

    Parameters
    ----------
    P_GT_nominal : nominal output from OEM curve [MW]
    P_amb        : actual ambient pressure [hPa]
    """
    return P_GT_nominal * (P_amb / P_AMB_0) + P_EXC


# ---------------------------------------------------------------------------
# Compressor thermodynamic state
# ---------------------------------------------------------------------------

def compressor_state(
    T_CI: float,
    P_eff_hPa: float,
    eta_c_is: float = ETA_C_IS_DESIGN,
    PR: float = PR_DESIGN,
) -> dict:
    """
    Calculate compressor inlet and outlet state.

    Uses CoolProp for isentropic outlet temperature (rigorous),
    then applies isentropic efficiency to get actual outlet temperature.

    Parameters
    ----------
    T_CI      : compressor inlet (ambient) temperature [°C]
    P_eff_hPa : effective compressor inlet pressure = P_amb - ΔP_filter [hPa]
    eta_c_is  : compressor isentropic efficiency [-]
    PR        : compressor pressure ratio [-]

    Returns
    -------
    dict with:
      T1_C, P1_hPa          : inlet state
      T3_is_C               : isentropic outlet temperature [°C]
      T3_C                  : actual outlet temperature [°C]
      P3_hPa                : outlet pressure [hPa]
      W_c_kJ_kg             : specific compressor work [kJ/kg]
      eta_c_is              : isentropic efficiency used [-]
      Cp_air_kJ_kgK         : Cp of air at inlet [kJ/(kg·K)]
      gamma_air             : gamma of air at inlet [-]
    """
    T1_C    = T_CI
    P1_hPa  = P_eff_hPa
    P3_hPa  = P_eff_hPa * PR

    # Isentropic outlet temperature via CoolProp (entropy matching)
    T3_is_C = air_isentropic_temperature(T1_C, P1_hPa, P3_hPa)

    # Actual outlet temperature
    T3_C = T1_C + (T3_is_C - T1_C) / eta_c_is

    # Specific compressor work
    Cp_in, gamma_in = air_cp_gamma(T1_C, P1_hPa)
    W_c = Cp_in * (T3_C - T1_C)     # kJ/kg

    return {
        "T1_C":         T1_C,
        "P1_hPa":       P1_hPa,
        "T3_is_C":      T3_is_C,
        "T3_C":         T3_C,
        "P3_hPa":       P3_hPa,
        "W_c_kJ_kg":    W_c,
        "eta_c_is":     eta_c_is,
        "Cp_air_kJ_kgK": Cp_in,
        "gamma_air":    gamma_in,
    }


def compressor_efficiency_from_measurement(
    T_CI: float, T3_measured_C: float, P_eff_hPa: float, PR_measured: float
) -> dict:
    """
    Back-calculate compressor isentropic and polytropic efficiency
    from measured T3 and P3.

    Parameters
    ----------
    T_CI           : compressor inlet temperature [°C]
    T3_measured_C  : measured compressor outlet temperature [°C]
    P_eff_hPa      : effective inlet pressure [hPa]
    PR_measured    : measured pressure ratio P3/P1 [-]

    Returns
    -------
    dict with eta_c_is, eta_c_poly
    """
    P3_hPa  = P_eff_hPa * PR_measured
    T3_is_C = air_isentropic_temperature(T_CI, P_eff_hPa, P3_hPa)

    T1_K  = T_CI + 273.15
    T3_K  = T3_measured_C + 273.15
    T3_is_K = T3_is_C + 273.15

    eta_c_is = (T3_is_K - T1_K) / (T3_K - T1_K)

    # Polytropic efficiency: η_poly = [(γ-1)/γ] × ln(PR) / ln(T3/T1)
    _, gamma = air_cp_gamma(T_CI, P_eff_hPa)
    eta_c_poly = ((gamma - 1.0) / gamma) * math.log(PR_measured) / \
                  math.log(T3_K / T1_K)

    return {
        "T3_is_C":    T3_is_C,
        "eta_c_is":   eta_c_is,
        "eta_c_poly": eta_c_poly,
    }


# ---------------------------------------------------------------------------
# Mode 1 — Measured GT output → heat rate
# ---------------------------------------------------------------------------

def mode1_solve(
    T_CI: float,
    P_amb: float,
    RH_pct: float,
    P_GT_actual_MW: float,
    fuel: str = "gas",
    LHV: float = LHV_GAS,
    HHV_LHV_ratio: float = HHV_LHV_RATIO_GAS,
    hours_coalescer: float = 0.0,
    hours_prefilter: float = 0.0,
    hours_finefilter: float = 0.0,
    m_fuel_actual: float = None,
    eta_c_is: float = ETA_C_IS_DESIGN,
    PR: float = PR_DESIGN,
) -> dict:
    """
    Mode 1 — Known: ambient + measured GT gross output.
    Derived: heat rate, efficiency, expected fuel flow, deviations.

    Parameters
    ----------
    T_CI           : compressor inlet temperature [°C]
    P_amb          : actual barometric pressure [hPa]
    RH_pct         : relative humidity [%]
    P_GT_actual_MW : measured GT gross output at generator terminals [MW]
    fuel           : 'gas' or 'oil'
    LHV            : fuel lower heating value [kJ/kg]
    HHV_LHV_ratio  : HHV/LHV ratio for this fuel [-]
    hours_coalescer  : hours since coalescer replacement
    hours_prefilter  : hours since pre-filter replacement
    hours_finefilter : hours since fine-filter replacement
    m_fuel_actual  : measured fuel flow [kg/s] (optional — enables actual η)
    eta_c_is       : compressor isentropic efficiency to use [-]
    PR             : compressor pressure ratio [-]

    Returns
    -------
    Comprehensive result dict — see inline keys
    """
    result = {}

    # ---- 1. Filter ΔP and effective inlet pressure ----
    filt = filter_delta_p(hours_coalescer, hours_prefilter, hours_finefilter)
    P_eff_hPa = P_amb - filt["dp_total_hPa"]
    result["filter"] = filt
    result["P_eff_hPa"] = P_eff_hPa

    # ---- 2. OEM reference output at current T_CI ----
    P_GT_oem, T_TII_oem = oem_curve_lookup(T_CI, fuel)
    P_GTM_design = pressure_corrected_output(P_GT_oem, P_amb)
    result["P_GT_oem_MW"]    = P_GT_oem
    result["P_GTM_design_MW"] = P_GTM_design
    result["T_TII_oem_C"]    = T_TII_oem

    # ---- 3. Output deviation from OEM reference ----
    delta_P_MW = P_GT_actual_MW - P_GTM_design
    result["delta_P_MW"] = delta_P_MW
    result["delta_P_pct"] = (delta_P_MW / P_GTM_design) * 100.0 if P_GTM_design else None

    # ---- 4. Design efficiency at current ambient (pressure-corrected) ----
    if fuel == "gas":
        from config.sirajganj import ETA_GT_DESIGN_GAS as eta_design_base
    else:
        from config.sirajganj import ETA_GT_DESIGN_OIL as eta_design_base

    # Design efficiency corrected for actual vs reference pressure
    eta_design_corrected = eta_design_base * (P_eff_hPa / (P_AMB_0 - DP_INLET_ISO))
    result["eta_design_pct"] = eta_design_corrected

    # ---- 5. Expected fuel flow at design efficiency ----
    Q_expected_kW  = (P_GT_actual_MW * 1000.0) / (eta_design_corrected / 100.0)
    m_fuel_expected = Q_expected_kW / LHV      # kg/s
    result["Q_expected_kW"]      = Q_expected_kW
    result["m_fuel_expected_kgs"] = m_fuel_expected

    # ---- 6. Design heat rate ----
    HR_LHV_design = 3600.0 / (eta_design_corrected / 100.0)
    HR_HHV_design = HR_LHV_design * HHV_LHV_ratio
    result["HR_LHV_design_kJ_kWh"] = HR_LHV_design
    result["HR_HHV_design_kJ_kWh"] = HR_HHV_design

    # ---- 7. Actual efficiency and heat rate (if measured fuel flow provided) ----
    if m_fuel_actual is not None and m_fuel_actual > 0:
        Q_actual_kW = m_fuel_actual * LHV
        eta_actual  = (P_GT_actual_MW * 1000.0) / Q_actual_kW * 100.0
        HR_LHV_actual = 3600.0 / (eta_actual / 100.0)
        HR_HHV_actual = HR_LHV_actual * HHV_LHV_ratio
        delta_eta   = eta_actual - eta_design_corrected
        delta_HR    = (HR_LHV_actual - HR_LHV_design) / HR_LHV_design * 100.0

        result["m_fuel_actual_kgs"]    = m_fuel_actual
        result["Q_actual_kW"]          = Q_actual_kW
        result["eta_actual_pct"]       = eta_actual
        result["eta_HHV_actual_pct"]   = eta_actual / HHV_LHV_ratio
        result["HR_LHV_actual_kJ_kWh"] = HR_LHV_actual
        result["HR_HHV_actual_kJ_kWh"] = HR_HHV_actual
        result["delta_eta_pp"]         = delta_eta
        result["delta_HR_pct"]         = delta_HR

    # ---- 8. Compressor state ----
    comp = compressor_state(T_CI, P_eff_hPa, eta_c_is, PR)
    result["compressor"] = comp

    # ---- 9. Exhaust mass flow estimate ----
    # m_air = m_exhaust - m_fuel; m_exhaust from OEM design scaling
    if fuel == "gas":
        from config.sirajganj import M_EXH_DESIGN_GAS as m_exh_design
        from config.sirajganj import M_FUEL_DESIGN_GAS as m_fuel_design
    else:
        from config.sirajganj import M_EXH_DESIGN_OIL as m_exh_design
        from config.sirajganj import M_FUEL_DESIGN_OIL as m_fuel_design

    # Scale exhaust flow linearly with inlet air density relative to design
    rho_actual = moist_air_density(T_CI, P_eff_hPa, RH_pct)
    from config.sirajganj import T_AMB_DESIGN, RH_DESIGN
    P_eff_design = P_AMB_0 - DP_INLET_ISO
    rho_design = moist_air_density(T_AMB_DESIGN, P_eff_design, RH_DESIGN)
    density_ratio = rho_actual / rho_design

    m_exh_estimated = m_exh_design * density_ratio
    m_air_estimated = m_exh_estimated - (m_fuel_actual if m_fuel_actual else m_fuel_design)
    result["rho_inlet_kg_m3"]   = rho_actual
    result["density_ratio"]     = density_ratio
    result["m_exh_estimated_kgs"] = m_exh_estimated
    result["m_air_estimated_kgs"] = max(m_air_estimated, 0.0)

    # ---- 10. Compressor power consumed ----
    P_c_MW = m_air_estimated * comp["W_c_kJ_kg"] / 1000.0
    result["P_compressor_MW"] = P_c_MW

    # ---- 11. Turbine inlet temperature (back-calculated from energy balance) ----
    # Energy balance: Q_in = W_turbine - W_compressor + losses
    # Simplified: T4 from combustor energy balance
    # h4 = h3 + Q_in/m_exh (approximate, treating exhaust as combustion products)
    if m_fuel_actual is not None and m_fuel_actual > 0:
        Q_in_kW = m_fuel_actual * LHV
    else:
        Q_in_kW = Q_expected_kW

    Cp_exh_T3 = exhaust_cp(comp["T3_C"])
    T4_C = comp["T3_C"] + (Q_in_kW / (m_exh_estimated * Cp_exh_T3))
    result["T4_TIT_C"] = T4_C     # turbine inlet temperature estimate

    # ---- 12. Turbine outlet temperature (from OEM curve) ----
    # Use OEM ϑTII as reference; if actual output differs, scale slightly
    result["T5_TII_oem_C"] = T_TII_oem

    return result


# ---------------------------------------------------------------------------
# Mode 2 — Fuel input → expected GT output
# ---------------------------------------------------------------------------

def mode2_solve(
    T_CI: float,
    P_amb: float,
    RH_pct: float,
    m_fuel_kgs: float,
    LHV: float = LHV_GAS,
    HHV: float = None,
    fuel: str = "gas",
    HHV_LHV_ratio: float = HHV_LHV_RATIO_GAS,
    hours_coalescer: float = 0.0,
    hours_prefilter: float = 0.0,
    hours_finefilter: float = 0.0,
    eta_c_is: float = ETA_C_IS_DESIGN,
    PR: float = PR_DESIGN,
) -> dict:
    """
    Mode 2 — Known: ambient + fuel flow + LHV/HHV.
    Derived: expected GT gross output, net busbar, heat rate, efficiency.

    Parameters
    ----------
    T_CI         : compressor inlet temperature [°C]
    P_amb        : actual barometric pressure [hPa]
    RH_pct       : relative humidity [%]
    m_fuel_kgs   : fuel mass flow rate [kg/s]
    LHV          : fuel lower heating value [kJ/kg]
    HHV          : fuel higher heating value [kJ/kg] (optional; derived from ratio if None)
    fuel         : 'gas' or 'oil'
    HHV_LHV_ratio: HHV/LHV ratio [-]
    hours_*      : filter operating hours
    eta_c_is     : compressor isentropic efficiency [-]
    PR           : compressor pressure ratio [-]

    Returns
    -------
    Comprehensive result dict
    """
    result = {}

    if HHV is None:
        HHV = LHV * HHV_LHV_ratio

    # ---- 1. Heat input ----
    Q_in_kW = m_fuel_kgs * LHV
    result["m_fuel_kgs"]    = m_fuel_kgs
    result["LHV_kJ_kg"]     = LHV
    result["HHV_kJ_kg"]     = HHV
    result["Q_in_LHV_kW"]   = Q_in_kW
    result["Q_in_LHV_MW"]   = Q_in_kW / 1000.0

    # ---- 2. Filter ΔP and effective inlet pressure ----
    filt = filter_delta_p(hours_coalescer, hours_prefilter, hours_finefilter)
    P_eff_hPa = P_amb - filt["dp_total_hPa"]
    result["filter"]    = filt
    result["P_eff_hPa"] = P_eff_hPa

    # ---- 3. Design efficiency at current ambient ----
    if fuel == "gas":
        from config.sirajganj import ETA_GT_DESIGN_GAS as eta_design_base
    else:
        from config.sirajganj import ETA_GT_DESIGN_OIL as eta_design_base

    eta_design_corrected = eta_design_base * (P_eff_hPa / (P_AMB_0 - DP_INLET_ISO))
    result["eta_design_pct"] = eta_design_corrected

    # ---- 4. Expected GT output ----
    P_GT_expected_kW = Q_in_kW * (eta_design_corrected / 100.0)
    P_GT_expected_MW = P_GT_expected_kW / 1000.0
    result["P_GT_expected_MW"] = P_GT_expected_MW

    # ---- 5. OEM reference at this T_CI ----
    P_GT_oem, T_TII_oem = oem_curve_lookup(T_CI, fuel)
    P_GTM_design = pressure_corrected_output(P_GT_oem, P_amb)
    result["P_GT_oem_MW"]     = P_GT_oem
    result["P_GTM_design_MW"] = P_GTM_design
    result["T_TII_oem_C"]     = T_TII_oem

    # ---- 6. Output deviation from OEM reference ----
    delta_P_MW  = P_GT_expected_MW - P_GTM_design
    result["delta_P_MW"]  = delta_P_MW
    result["delta_P_pct"] = (delta_P_MW / P_GTM_design) * 100.0 if P_GTM_design else None

    # ---- 7. Heat rates ----
    HR_LHV = 3600.0 / (eta_design_corrected / 100.0)
    HR_HHV = HR_LHV * HHV_LHV_ratio
    HR_LHV_actual = (Q_in_kW / P_GT_expected_kW) * 3600.0 if P_GT_expected_kW > 0 else None
    HR_HHV_actual = HR_LHV_actual * HHV_LHV_ratio if HR_LHV_actual else None

    result["HR_LHV_kJ_kWh"]        = HR_LHV_actual
    result["HR_HHV_kJ_kWh"]        = HR_HHV_actual
    result["HR_LHV_design_kJ_kWh"] = HR_LHV
    result["HR_HHV_design_kJ_kWh"] = HR_HHV

    # ---- 8. LHV and HHV efficiencies ----
    eta_LHV = (P_GT_expected_kW / Q_in_kW) * 100.0 if Q_in_kW > 0 else None
    eta_HHV = eta_LHV / HHV_LHV_ratio if eta_LHV else None
    result["eta_LHV_pct"] = eta_LHV
    result["eta_HHV_pct"] = eta_HHV

    # ---- 9. Compressor state ----
    comp = compressor_state(T_CI, P_eff_hPa, eta_c_is, PR)
    result["compressor"] = comp

    # ---- 10. Exhaust flow and turbine inlet temperature ----
    rho_actual = moist_air_density(T_CI, P_eff_hPa, RH_pct)
    from config.sirajganj import T_AMB_DESIGN, RH_DESIGN
    P_eff_design = P_AMB_0 - DP_INLET_ISO
    rho_design = moist_air_density(T_AMB_DESIGN, P_eff_design, RH_DESIGN)
    density_ratio = rho_actual / rho_design

    if fuel == "gas":
        from config.sirajganj import M_EXH_DESIGN_GAS as m_exh_design
    else:
        from config.sirajganj import M_EXH_DESIGN_OIL as m_exh_design

    m_exh_estimated = m_exh_design * density_ratio
    m_air_estimated = max(m_exh_estimated - m_fuel_kgs, 0.0)

    result["rho_inlet_kg_m3"]     = rho_actual
    result["density_ratio"]       = density_ratio
    result["m_exh_estimated_kgs"] = m_exh_estimated
    result["m_air_estimated_kgs"] = m_air_estimated

    Cp_exh_T3 = exhaust_cp(comp["T3_C"])
    T4_C = comp["T3_C"] + (Q_in_kW / (m_exh_estimated * Cp_exh_T3))
    result["T4_TIT_C"] = T4_C

    result["T5_TII_oem_C"] = T_TII_oem

    return result

