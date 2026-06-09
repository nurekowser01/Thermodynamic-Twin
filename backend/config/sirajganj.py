"""
sirajganj.py
============
All OEM design constants for the Sirajganj 150 MW Peaking Power Plant
SGT5-2000E Gas Turbine, Serial No. 800849.

Sources
-------
3.1-0100-00849  Design Data (GT Technical Data)
3.1-0001-0849   Rating Plate Data
3.1-0124-0849   Generator Output & ϑTII vs T_CI, Natural Gas
3.1-0125-0849   Generator Output & ϑTII vs T_CI, Fuel Oil
3.1-0118-6432   Setting of Temperature Limits at the Turbine Outlet
3.1-0164-9421   Specification: Natural Gas
"""

# ---------------------------------------------------------------------------
# Machine identity
# ---------------------------------------------------------------------------
GT_TYPE          = "SGT5-2000E"
SERIAL_NO        = "800849"
YEAR_MFG         = 2011
SPEED_RPM        = 3000            # nominal shaft speed [rpm]
SPEED_HZ         = 50.0            # 50 s-1

# ---------------------------------------------------------------------------
# OEM design-point reference conditions  (3.1-0100-00849)
# ---------------------------------------------------------------------------
T_AMB_DESIGN     = 35.0            # ambient / compressor inlet temperature [°C]
P_AMB_0          = 1013.0          # reference barometric pressure [hPa]
RH_DESIGN        = 97.88           # relative humidity [%]
DP_INLET_ISO     = 8.0             # pressure loss at compressor inlet (ISO) [hPa]
DP_OUTLET_ISO    = 8.0             # pressure loss at turbine outlet (ISO) [hPa]

# ---------------------------------------------------------------------------
# Design-point performance — Natural Gas  (3.1-0100-00849)
# ---------------------------------------------------------------------------
P_GT_DESIGN_GAS  = 142.2           # nominal output at generator terminals, gas [MW]
ETA_GT_DESIGN_GAS= 33.6            # nominal thermal efficiency, LHV basis, gas [%]
M_EXH_DESIGN_GAS = 487.3           # exhaust gas mass flow, gas [kg/s]
T_EXH_DESIGN_GAS = 567.0           # exhaust gas temperature (ϑTII), gas [°C]
M_FUEL_DESIGN_GAS= 8.6             # fuel consumption, gas [kg/s]
LHV_GAS          = 48_982.0        # lower heating value, natural gas [kJ/kg]

# ---------------------------------------------------------------------------
# Design-point performance — Fuel Oil  (3.1-0100-00849)
# ---------------------------------------------------------------------------
P_GT_DESIGN_OIL  = 158.7           # nominal output, oil [MW]
ETA_GT_DESIGN_OIL= 31.5            # nominal thermal efficiency, LHV basis, oil [%]
M_EXH_DESIGN_OIL = 498.4           # exhaust gas mass flow, oil [kg/s]
T_EXH_DESIGN_OIL = 564.1           # exhaust gas temperature (ϑTII), oil [°C]
M_FUEL_DESIGN_OIL= 11.7            # fuel consumption, oil [kg/s]
LHV_OIL          = 43_040.0        # lower heating value, fuel oil [kJ/kg]
M_WATER_OIL      = 1.60            # water injection fraction of MBR for oil firing

# ---------------------------------------------------------------------------
# Electrical / excitation  (3.1-0100-00849, 3.1-0124-0849)
# ---------------------------------------------------------------------------
P_EXC            = 0.5             # nominal excitation power losses [MW]
POWER_FACTOR     = 0.8             # nominal power factor
P_RATING         = 173.0           # rating limit [MW]

# ---------------------------------------------------------------------------
# OEM performance curve — Natural Gas  (3.1-0124-0849)
# Digitised from drawing 3.1-0124-0849.
# Reference: p_amb,0 = 1013 hPa, φ = 98%, ΔpC = ΔpE = 8 hPa, IGV ~100 %
# T_CI in °C, P_GT in MW (nominal, before excitation correction),
# T_TII in °C (mean turbine exhaust temperature ϑTII)
# ---------------------------------------------------------------------------
OEM_CURVE_GAS = {
    # T_CI [°C] : (P_GT [MW], ϑTII [°C])
     5: (172.0, 543),
    10: (166.5, 547),
    15: (161.0, 551),
    20: (155.5, 556),
    25: (150.0, 561),
    30: (144.5, 565),
    35: (142.2, 567),
    40: (138.5, 572),
    45: (135.0, 580),
}

# ---------------------------------------------------------------------------
# OEM performance curve — Fuel Oil  (3.1-0125-0849)
# Digitised from drawing 3.1-0125-0849.
# Reference: p_amb,0 = 1013 hPa, φ = 98%, ΔpC = ΔpE = 8 hPa, IGV ~100 %
# T_CI in °C, P_GT in MW, ϑTII in °C
# ---------------------------------------------------------------------------
OEM_CURVE_OIL = {
     5: (173.0, 545),
    10: (173.0, 548),
    15: (173.0, 551),
    20: (173.0, 554),
    25: (170.0, 558),
    30: (163.0, 562),
    35: (158.7, 564),
    40: (154.0, 570),
    45: (148.0, 578),
}

# ---------------------------------------------------------------------------
# Compressor model parameters  (SGT5-2000E class, agreed PR = 12.0)
# ---------------------------------------------------------------------------
PR_DESIGN        = 12.0            # compressor pressure ratio [-]
ETA_C_IS_DESIGN  = 0.875           # compressor isentropic efficiency, design [-]
GAMMA_AIR        = 1.37            # ratio of specific heats for air (compromise) [-]
CP_AIR           = 1.005           # specific heat of air at constant pressure [kJ/(kg·K)]
R_AIR            = 287.05          # specific gas constant, air [J/(kg·K)]

# ---------------------------------------------------------------------------
# Turbine model parameters  (SGT5-2000E class, placeholder — replace with OEM value)
# ---------------------------------------------------------------------------
ETA_T_IS_DESIGN  = 0.880           # turbine isentropic efficiency, design [-]  ← PLACEHOLDER
GAMMA_GAS_HOT    = 1.33            # ratio of specific heats, hot combustion gas [-]
CP_GAS_HOT       = 1.148           # specific heat, combustion products [kJ/(kg·K)]

# ---------------------------------------------------------------------------
# Inlet filter train — FAIST  (equations document, Siemens specification)
# ---------------------------------------------------------------------------
FILTER_STAGES = {
    "coalescer": {
        "dp_initial_Pa": 65,
        "dp_final_Pa":   450,
        "life_hours":    4_000,
    },
    "prefilter": {
        "dp_initial_Pa": 65,
        "dp_final_Pa":   250,
        "life_hours":    5_000,
    },
    "finefilter": {
        "dp_initial_Pa": 95,
        "dp_final_Pa":   600,
        "life_hours":    10_000,
    },
}
DP_FILTER_ISO_hPa = 8.0            # ISO reference filter ΔP [hPa] (mid-life equivalent)

# ---------------------------------------------------------------------------
# Gas Booster Compressor (GBC) parameters  (equations document)
# ---------------------------------------------------------------------------
GBC_N_UNITS          = 2           # number of GBC units installed
GBC_N_UNITS_RUNNING  = 1           # units normally in service (1 runs, 1 standby)
GBC_FLOW_KG_HR       = 33_000.0    # design mass flow per GBC unit [kg/hr]
GBC_P_INLET_BAR      = 9.5         # default RMS delivery pressure [bar] — operator input each run
GBC_PR               = 2.5         # GBC compression ratio [-] (OEM spec)
GBC_P_OUTLET_BAR     = 23.75       # GT fuel inlet flange pressure [bar] (= 9.5 x 2.5)
GBC_ETA_ISENTROPIC   = 0.72        # GBC isentropic efficiency [-]
GBC_ETA_MECHANICAL   = 0.95        # GBC mechanical + motor efficiency [-]
GAMMA_GAS            = 1.32        # ratio of specific heats, natural gas [-]
R_GAS                = 518.3       # specific gas constant, natural gas [J/(kg·K)]

# ---------------------------------------------------------------------------
# Natural gas fuel specification limits  (3.1-0164-9421)
# ---------------------------------------------------------------------------
GAS_LHV_MIN_MJ_KG    = 35.0        # minimum LHV [MJ/kg]
GAS_LHV_MAX_MJ_KG    = 50.0        # maximum LHV [MJ/kg]
GAS_WOBBE_MIN_MJ_M3  = 37.0        # minimum Lower Wobbe Index [MJ/m³_stp]
GAS_WOBBE_MAX_MJ_M3  = 51.0        # maximum Lower Wobbe Index [MJ/m³_stp]
GAS_TEMP_MIN_C       = 5.0         # minimum fuel gas temperature [°C]
GAS_TEMP_MAX_C       = 60.0        # maximum fuel gas temperature [°C]

# ---------------------------------------------------------------------------
# HHV/LHV ratio for natural gas  (used for HHV efficiency and heat rate)
# Pure CH4 = 1.1099; typical Bangladeshi gas ~90% CH4: 1.103–1.112
# ---------------------------------------------------------------------------
HHV_LHV_RATIO_GAS    = 1.109       # default ratio (refine with chromatograph data)
HHV_LHV_RATIO_OIL    = 1.065       # typical ratio for distillate oil

# ---------------------------------------------------------------------------
# Turbine outlet temperature control  (3.1-0118-6432)
# ϑ_OTC = ϑ_OT - K × ϑ_CI
# K is plant-specific from the List of Settings.
# Alarm: ϑ_OTC + 13 °C;  Trip: ϑ_OTC + 39 °C
# ---------------------------------------------------------------------------
K_FACTOR             = None         # K factor — must be set from List of Settings
T_OTC_ALARM_MARGIN   = 13.0         # alarm margin above ϑ_OTC [°C]
T_OTC_TRIP_MARGIN    = 39.0         # trip margin above ϑ_OTC [°C]

# ---------------------------------------------------------------------------
# Other auxiliary loads (simple cycle, large consumers only)
# GBC and excitation handled explicitly in auxiliaries.py.
# ---------------------------------------------------------------------------
P_OTHER_AUX_MW       = 1.0          # other station auxiliaries estimate [MW]
