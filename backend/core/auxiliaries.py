"""
auxiliaries.py
==============
Auxiliary power consumer models for the Sirajganj simple cycle.

Consumers modelled
------------------
  GBC  — Gas Booster Compressor (1 of 2 units normally in service)
  EXC  — Generator excitation system (fixed loss, OEM data)

GBC notes
---------
  - 2 units installed, 1 normally in service, 1 on standby
  - Compression ratio = 2.5 (OEM spec)
  - Inlet pressure = RMS delivery pressure (operator input, varies)
  - Outlet pressure = P_inlet x PR (fixed ratio, not fixed absolute)
"""

from config.sirajganj import (
    GBC_N_UNITS,
    GBC_N_UNITS_RUNNING,
    GBC_FLOW_KG_HR,
    GBC_P_INLET_BAR,
    GBC_PR,
    GBC_P_OUTLET_BAR,
    GBC_ETA_ISENTROPIC,
    GBC_ETA_MECHANICAL,
    GAMMA_GAS,
    R_GAS,
    P_EXC,
)
from core.properties import ng_isentropic_work


def gbc_power(
    n_units_running: int = GBC_N_UNITS_RUNNING,
    P_rms_bar: float = GBC_P_INLET_BAR,
    PR: float = GBC_PR,
    T_inlet_C: float = 35.0,
    flow_kg_hr_per_unit: float = GBC_FLOW_KG_HR,
    eta_is: float = GBC_ETA_ISENTROPIC,
    eta_mech: float = GBC_ETA_MECHANICAL,
) -> dict:
    """
    Calculate gas booster compressor electrical load.

    Parameters
    ----------
    n_units_running      : number of GBC units in service (0, 1, or 2)
    P_rms_bar            : RMS delivery pressure — operator input [bar]
    PR                   : GBC compression ratio [-] (default 2.5)
    T_inlet_C            : gas temperature at GBC inlet [°C]
    flow_kg_hr_per_unit  : mass flow per running unit [kg/hr]
    eta_is               : isentropic efficiency [-]
    eta_mech             : mechanical + motor efficiency [-]

    Returns
    -------
    dict with:
      P_inlet_bar      : RMS pressure used [bar]
      P_outlet_bar     : GBC outlet pressure [bar]
      PR               : actual compression ratio used [-]
      W_is_kJ_kg       : isentropic specific work [kJ/kg]
      W_actual_kJ_kg   : actual specific work [kJ/kg]
      P_per_unit_MW    : electrical power per running unit [MW]
      P_total_MW       : total GBC electrical load [MW]
      n_units_running  : units in service
    """
    P_outlet_bar = P_rms_bar * PR

    if n_units_running == 0:
        return {
            "P_inlet_bar":     P_rms_bar,
            "P_outlet_bar":    P_outlet_bar,
            "PR":              PR,
            "W_is_kJ_kg":     0.0,
            "W_actual_kJ_kg": 0.0,
            "P_per_unit_MW":  0.0,
            "P_total_MW":     0.0,
            "n_units_running": 0,
        }

    m_dot_per_unit = flow_kg_hr_per_unit / 3600.0      # kg/s

    W_is = ng_isentropic_work(
        T_inlet_C, P_rms_bar, P_outlet_bar, GAMMA_GAS, R_GAS
    )                                                   # kJ/kg
    W_actual = W_is / eta_is                            # kJ/kg

    P_elec_per_unit = (m_dot_per_unit * W_actual) / eta_mech / 1000.0  # MW
    P_total = P_elec_per_unit * n_units_running

    return {
        "P_inlet_bar":     P_rms_bar,
        "P_outlet_bar":    P_outlet_bar,
        "PR":              PR,
        "W_is_kJ_kg":     W_is,
        "W_actual_kJ_kg": W_actual,
        "P_per_unit_MW":  P_elec_per_unit,
        "P_total_MW":     P_total,
        "n_units_running": n_units_running,
    }


def excitation_loss() -> float:
    """
    Return fixed excitation power loss [MW].
    Source: 3.1-0100-00849 — Nominal excitation power losses ca. 0.5 MW.
    """
    return P_EXC
