"""
plant_balance.py
================
Net plant output and full energy balance for the Sirajganj simple cycle.

Responsibilities
----------------
  1. Net busbar output = GT gross output - all auxiliary loads
  2. Full heat balance at every cycle node
  3. Energy flow dictionary for Sankey diagram rendering
  4. Performance summary (heat rate, efficiency, deviations)
"""

from config.sirajganj import (
    P_OTHER_AUX_MW,
    HHV_LHV_RATIO_GAS,
    HHV_LHV_RATIO_OIL,
    LHV_GAS,
)
from core.auxiliaries import gbc_power, excitation_loss
from core.properties import exhaust_cp


def net_output(
    P_GT_MW: float,
    P_GBC_MW: float,
    P_other_aux_MW: float = P_OTHER_AUX_MW,
) -> dict:
    """
    Calculate net busbar output after all auxiliary deductions.

    Parameters
    ----------
    P_GT_MW        : GT gross output at generator terminals [MW]
    P_GBC_MW       : total GBC electrical load [MW]
    P_other_aux_MW : all other station auxiliaries [MW]

    Returns
    -------
    dict with P_gross_MW, P_EXC_MW, P_GBC_MW, P_other_aux_MW, P_net_MW
    """
    P_EXC = excitation_loss()
    P_net = P_GT_MW - P_EXC - P_GBC_MW - P_other_aux_MW
    return {
        "P_gross_MW":     P_GT_MW,
        "P_EXC_MW":       P_EXC,
        "P_GBC_MW":       P_GBC_MW,
        "P_other_aux_MW": P_other_aux_MW,
        "P_net_MW":       P_net,
    }


def heat_balance(
    P_GT_MW: float,
    Q_in_kW: float,
    m_exh_kgs: float,
    T_exh_C: float,
    T_amb_C: float,
    HHV_LHV_ratio: float = HHV_LHV_RATIO_GAS,
) -> dict:
    """
    Full heat balance for the simple cycle GT.

    Energy in  = fuel heat input (LHV basis)
    Energy out = GT shaft/electrical output + exhaust enthalpy above ambient
                 + radiation/unaccounted losses (by difference)

    Parameters
    ----------
    P_GT_MW        : GT gross electrical output [MW]
    Q_in_kW        : total fuel heat input, LHV basis [kW]
    m_exh_kgs      : exhaust mass flow rate [kg/s]
    T_exh_C        : exhaust temperature (ϑTII) [°C]
    T_amb_C        : ambient / reference temperature [°C]
    HHV_LHV_ratio  : HHV/LHV ratio for fuel [-]

    Returns
    -------
    dict with full heat balance breakdown [all values in MW]
    """
    Q_in_MW = Q_in_kW / 1000.0

    # Exhaust enthalpy above ambient
    Cp_exh = exhaust_cp((T_exh_C + T_amb_C) / 2.0)   # mean temperature Cp
    Q_exh_MW = m_exh_kgs * Cp_exh * (T_exh_C - T_amb_C) / 1000.0

    # Radiation and unaccounted losses (residual by energy balance)
    Q_rad_MW = Q_in_MW - (P_GT_MW + Q_exh_MW)
    Q_rad_MW = max(Q_rad_MW, 0.0)   # clamp: prevents negative if estimate drift

    # Efficiencies
    eta_LHV = (P_GT_MW / Q_in_MW) * 100.0 if Q_in_MW > 0 else 0.0
    eta_HHV = eta_LHV / HHV_LHV_ratio

    # Heat rates
    HR_LHV = 3600.0 / (eta_LHV / 100.0) if eta_LHV > 0 else None
    HR_HHV = HR_LHV * HHV_LHV_ratio if HR_LHV else None

    # Exhaust energy as fraction of fuel input
    exhaust_fraction = (Q_exh_MW / Q_in_MW) * 100.0 if Q_in_MW > 0 else 0.0

    return {
        "Q_in_LHV_MW":       Q_in_MW,
        "Q_in_HHV_MW":       Q_in_MW * HHV_LHV_ratio,
        "P_GT_MW":           P_GT_MW,
        "Q_exhaust_MW":      Q_exh_MW,
        "Q_radiation_MW":    Q_rad_MW,
        "eta_LHV_pct":       eta_LHV,
        "eta_HHV_pct":       eta_HHV,
        "HR_LHV_kJ_kWh":     HR_LHV,
        "HR_HHV_kJ_kWh":     HR_HHV,
        "exhaust_fraction_pct": exhaust_fraction,
        "electrical_fraction_pct": (P_GT_MW / Q_in_MW) * 100.0 if Q_in_MW > 0 else 0.0,
    }


def sankey_flows(
    Q_in_MW: float,
    P_GT_MW: float,
    Q_exh_MW: float,
    Q_rad_MW: float,
    P_EXC_MW: float,
    P_GBC_MW: float,
    P_other_aux_MW: float,
) -> dict:
    """
    Build the energy flow dictionary for Sankey diagram rendering.
    Arrow widths in the browser UI are proportional to MW values.

    Flow topology (simple cycle)
    ----------------------------
    Fuel Q_in
      └─► GT shaft work
            ├─► Gross electrical output
            │     ├─► Net busbar export
            │     ├─► Excitation loss
            │     ├─► GBC load
            │     └─► Other auxiliaries
            └─► (internally balanced — not shown separately)
      └─► Exhaust stack loss
      └─► Radiation / unaccounted

    Parameters
    ----------
    All values in MW.

    Returns
    -------
    dict with 'nodes' list and 'links' list suitable for D3 Sankey rendering.
    """
    P_net_MW = P_GT_MW - P_EXC_MW - P_GBC_MW - P_other_aux_MW

    nodes = [
        {"id": "fuel",       "label": "Fuel Heat Input"},
        {"id": "gt_gross",   "label": "GT Gross Output"},
        {"id": "net_export", "label": "Net Export"},
        {"id": "exc_loss",   "label": "Excitation Loss"},
        {"id": "gbc_load",   "label": "GBC Load"},
        {"id": "aux_load",   "label": "Other Auxiliaries"},
        {"id": "exhaust",    "label": "Exhaust (Stack)"},
        {"id": "radiation",  "label": "Radiation / Mech. Loss"},
    ]

    links = [
        # fuel → gross electrical
        {"source": "fuel",     "target": "gt_gross",   "value": P_GT_MW},
        # fuel → exhaust
        {"source": "fuel",     "target": "exhaust",    "value": Q_exh_MW},
        # fuel → radiation
        {"source": "fuel",     "target": "radiation",  "value": max(Q_rad_MW, 0.0)},
        # gross → net export
        {"source": "gt_gross", "target": "net_export", "value": max(P_net_MW, 0.0)},
        # gross → excitation
        {"source": "gt_gross", "target": "exc_loss",   "value": P_EXC_MW},
        # gross → GBC
        {"source": "gt_gross", "target": "gbc_load",   "value": P_GBC_MW},
        # gross → other aux
        {"source": "gt_gross", "target": "aux_load",   "value": P_other_aux_MW},
    ]

    return {
        "nodes": nodes,
        "links": links,
        "summary": {
            "Q_in_MW":       Q_in_MW,
            "P_GT_MW":       P_GT_MW,
            "P_net_MW":      P_net_MW,
            "Q_exh_MW":      Q_exh_MW,
            "Q_rad_MW":      Q_rad_MW,
            "P_EXC_MW":      P_EXC_MW,
            "P_GBC_MW":      P_GBC_MW,
            "P_other_MW":    P_other_aux_MW,
        }
    }


def full_balance(
    gt_result: dict,
    n_gbc_units: int = 1,
    P_rms_bar: float = None,
    T_gbc_inlet_C: float = 35.0,
    P_other_aux_MW: float = P_OTHER_AUX_MW,
    fuel: str = "gas",
) -> dict:
    """
    Assemble the complete plant balance from a gt_model result dict.

    Parameters
    ----------
    gt_result       : output dict from mode1_solve() or mode2_solve()
    n_gbc_units     : number of GBC units in service (default 1)
    P_rms_bar       : RMS delivery pressure [bar] — operator input (uses default if None)
    T_gbc_inlet_C   : GBC gas inlet temperature [°C]
    P_other_aux_MW  : other station auxiliary load [MW]
    fuel            : 'gas' or 'oil'

    Returns
    -------
    dict with net_output, heat_balance, sankey, and gbc sub-dicts
    """
    from config.sirajganj import GBC_P_INLET_BAR, GBC_PR
    from config.sirajganj import HHV_LHV_RATIO_OIL

    if P_rms_bar is None:
        P_rms_bar = GBC_P_INLET_BAR

    HHV_ratio = HHV_LHV_RATIO_GAS if fuel == "gas" else HHV_LHV_RATIO_OIL

    # Determine GT output and fuel heat input from gt_result
    if "P_GT_expected_MW" in gt_result:
        # Mode 2 result
        P_GT_MW = gt_result["P_GT_expected_MW"]
        Q_in_kW = gt_result["Q_in_LHV_kW"]
    elif "P_GTM_design_MW" in gt_result:
        # Mode 1 result — use actual measured output
        P_GT_MW = gt_result.get("P_GT_actual_MW",
                  gt_result.get("P_GTM_design_MW"))
        Q_in_kW = gt_result.get("Q_actual_kW",
                  gt_result.get("Q_expected_kW"))
    else:
        raise KeyError("gt_result must come from mode1_solve or mode2_solve")

    # GBC load
    gbc = gbc_power(
        n_units_running=n_gbc_units,
        P_rms_bar=P_rms_bar,
        PR=GBC_PR,
        T_inlet_C=T_gbc_inlet_C,
    )

    # Net output
    net = net_output(P_GT_MW, gbc["P_total_MW"], P_other_aux_MW)

    # Heat balance
    m_exh = gt_result.get("m_exh_estimated_kgs", 487.3)
    T_exh = gt_result.get("T5_TII_oem_C", 567.0)
    T_amb = gt_result.get("compressor", {}).get("T1_C", 35.0)

    hb = heat_balance(P_GT_MW, Q_in_kW, m_exh, T_exh, T_amb, HHV_ratio)

    # Sankey flows
    sk = sankey_flows(
        Q_in_MW      = Q_in_kW / 1000.0,
        P_GT_MW      = P_GT_MW,
        Q_exh_MW     = hb["Q_exhaust_MW"],
        Q_rad_MW     = hb["Q_radiation_MW"],
        P_EXC_MW     = excitation_loss(),
        P_GBC_MW     = gbc["P_total_MW"],
        P_other_aux_MW = P_other_aux_MW,
    )

    return {
        "net_output":   net,
        "heat_balance": hb,
        "sankey":       sk,
        "gbc":          gbc,
    }
