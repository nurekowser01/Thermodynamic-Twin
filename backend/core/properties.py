"""
properties.py
=============
CoolProp wrappers for thermodynamic fluid properties used in the GT twin.

Patched for CoolProp 7.x: HumidAirProp → HAPropsSI
"""

import math
from CoolProp.HumidAirProp import HAPropsSI
import CoolProp.CoolProp as CP


# ---------------------------------------------------------------------------
# Moist air — compressor inlet conditions
# ---------------------------------------------------------------------------

def moist_air_density(T_C: float, P_hPa: float, RH_pct: float) -> float:
    T_K  = T_C + 273.15
    P_Pa = P_hPa * 100.0
    RH   = RH_pct / 100.0
    v_ha = HAPropsSI("Vha", "T", T_K, "P", P_Pa, "R", RH)
    W    = HAPropsSI("W",   "T", T_K, "P", P_Pa, "R", RH)
    return (1.0 + W) / v_ha


def moist_air_humidity_ratio(T_C: float, P_hPa: float, RH_pct: float) -> float:
    T_K  = T_C + 273.15
    P_Pa = P_hPa * 100.0
    RH   = RH_pct / 100.0
    return HAPropsSI("W", "T", T_K, "P", P_Pa, "R", RH)


def moist_air_enthalpy(T_C: float, P_hPa: float, RH_pct: float) -> float:
    T_K  = T_C + 273.15
    P_Pa = P_hPa * 100.0
    RH   = RH_pct / 100.0
    h    = HAPropsSI("Hha", "T", T_K, "P", P_Pa, "R", RH)   # J/kg_humid_air
    W    = HAPropsSI("W",   "T", T_K, "P", P_Pa, "R", RH)
    return h * (1.0 + W) / 1000.0                             # kJ/kg_dry_air


def dew_point(T_C: float, P_hPa: float, RH_pct: float) -> float:
    T_K  = T_C + 273.15
    P_Pa = P_hPa * 100.0
    RH   = RH_pct / 100.0
    T_dew_K = HAPropsSI("Tdp", "T", T_K, "P", P_Pa, "R", RH)
    return T_dew_K - 273.15


# ---------------------------------------------------------------------------
# Dry air — isentropic compression/expansion via CoolProp 'Air'
# ---------------------------------------------------------------------------

def air_cp_gamma(T_C: float, P_hPa: float) -> tuple:
    T_K  = T_C + 273.15
    P_Pa = P_hPa * 100.0
    Cp   = CP.PropsSI("Cpmass", "T", T_K, "P", P_Pa, "Air")
    Cv   = CP.PropsSI("Cvmass", "T", T_K, "P", P_Pa, "Air")
    return Cp / 1000.0, Cp / Cv


def air_enthalpy(T_C: float, P_hPa: float) -> float:
    T_K  = T_C + 273.15
    P_Pa = P_hPa * 100.0
    return CP.PropsSI("Hmass", "T", T_K, "P", P_Pa, "Air") / 1000.0


def air_entropy(T_C: float, P_hPa: float) -> float:
    T_K  = T_C + 273.15
    P_Pa = P_hPa * 100.0
    return CP.PropsSI("Smass", "T", T_K, "P", P_Pa, "Air") / 1000.0


def air_isentropic_temperature(T1_C: float, P1_hPa: float, P2_hPa: float) -> float:
    T1_K  = T1_C + 273.15
    P1_Pa = P1_hPa * 100.0
    P2_Pa = P2_hPa * 100.0
    s1    = CP.PropsSI("Smass", "T", T1_K, "P", P1_Pa, "Air")
    T2_K  = CP.PropsSI("T", "Smass", s1, "P", P2_Pa, "Air")
    return T2_K - 273.15


# ---------------------------------------------------------------------------
# Natural gas — ideal gas approximation
# ---------------------------------------------------------------------------

def ng_isentropic_work(T_inlet_C, P_inlet_bar, P_outlet_bar, gamma_ng, R_ng):
    T_K  = T_inlet_C + 273.15
    PR   = P_outlet_bar / P_inlet_bar
    exp  = (gamma_ng - 1.0) / gamma_ng
    return (gamma_ng / (gamma_ng - 1.0)) * (R_ng / 1000.0) * T_K * (PR**exp - 1.0)


# ---------------------------------------------------------------------------
# Combustion products (exhaust) — Cp polynomial
# ---------------------------------------------------------------------------

def exhaust_cp(T_C: float) -> float:
    """Cp of GT exhaust gas [kJ/(kg·K)], valid 100–700 °C."""
    return 1.030 + 1.20e-4 * T_C
