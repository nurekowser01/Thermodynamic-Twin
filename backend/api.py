"""
api.py
======
FastAPI backend for the Sirajganj GT Digital Twin.
Wraps mode1_solve / mode2_solve / full_balance as REST endpoints.
Run: uvicorn api:app --reload --port 8749
"""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import math

from core.gt_model import mode1_solve, mode2_solve, oem_curve_lookup, compressor_state
from core.plant_balance import full_balance
from core.properties import moist_air_density, air_entropy, air_enthalpy, exhaust_cp
from config.sirajganj import (
    LHV_GAS, LHV_OIL, HHV_LHV_RATIO_GAS, HHV_LHV_RATIO_OIL,
    OEM_CURVE_GAS, OEM_CURVE_OIL,
    ETA_C_IS_DESIGN, PR_DESIGN,
    T_AMB_DESIGN, P_AMB_0, RH_DESIGN,
    P_GT_DESIGN_GAS, M_FUEL_DESIGN_GAS,
    FILTER_STAGES,
)

app = FastAPI(title="Sirajganj GT Twin API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])


# ── Request / Response models ─────────────────────────────────────────────

class Mode1Request(BaseModel):
    T_CI: float = Field(35.0,  description="Compressor inlet temperature [°C]")
    P_amb: float = Field(1013.0, description="Ambient pressure [hPa]")
    RH_pct: float = Field(97.88, description="Relative humidity [%]")
    P_GT_actual_MW: float = Field(142.2, description="Measured GT gross output [MW]")
    fuel: str = Field("gas", description="'gas' or 'oil'")
    LHV: Optional[float] = None
    HHV_LHV_ratio: Optional[float] = None
    m_fuel_actual: Optional[float] = None
    hours_coalescer: float = 0.0
    hours_prefilter: float = 0.0
    hours_finefilter: float = 0.0
    n_gbc_units: int = 1
    P_rms_bar: float = Field(9.5, description="RMS delivery pressure [bar]")
    eta_c_is: float = ETA_C_IS_DESIGN
    PR: float = PR_DESIGN

class Mode2Request(BaseModel):
    T_CI: float = Field(35.0)
    P_amb: float = Field(1013.0)
    RH_pct: float = Field(97.88)
    m_fuel_kgs: float = Field(8.6, description="Fuel mass flow [kg/s]")
    fuel: str = Field("gas")
    LHV: Optional[float] = None
    HHV_LHV_ratio: Optional[float] = None
    hours_coalescer: float = 0.0
    hours_prefilter: float = 0.0
    hours_finefilter: float = 0.0
    n_gbc_units: int = 1
    P_rms_bar: float = Field(9.5, description="RMS delivery pressure [bar]")
    eta_c_is: float = ETA_C_IS_DESIGN
    PR: float = PR_DESIGN

class FilterRequest(BaseModel):
    hours_coalescer: float = 0.0
    hours_prefilter: float = 0.0
    hours_finefilter: float = 0.0


# ── Helpers ───────────────────────────────────────────────────────────────

def _defaults(fuel, LHV, ratio):
    if fuel == "gas":
        return LHV or LHV_GAS, ratio or HHV_LHV_RATIO_GAS
    return LHV or LHV_OIL, ratio or HHV_LHV_RATIO_OIL

def _ts_points(gt):
    """Build T-s / P-h state point arrays from a gt_result dict."""
    comp = gt.get("compressor", {})
    T1   = comp.get("T1_C", 35.0)
    P1   = gt.get("P_eff_hPa", 1005.0)
    T3   = comp.get("T3_C", 391.0)
    T3is = comp.get("T3_is_C", 346.4)
    P3   = comp.get("P3_hPa", 12129.0)
    T4   = gt.get("T4_TIT_C", 1189.0)
    T5   = gt.get("T5_TII_oem_C", 567.0)

    import numpy as np
    import CoolProp.CoolProp as CP

    def s(T_C, P_hPa):
        return CP.PropsSI("Smass","T",T_C+273.15,"P",P_hPa*100,"Air")/1000
    def h(T_C, P_hPa):
        return CP.PropsSI("Hmass","T",T_C+273.15,"P",P_hPa*100,"Air")/1000

    s1=s(T1,P1); h1=h(T1,P1)
    s3is=s(T3is,P3); h3is=h(T3is,P3)
    s3=s(T3,P3);  h3=h(T3,P3)

    Cp_comb = exhaust_cp((T3+T4)/2)
    s4 = s3 + Cp_comb*math.log((T4+273.15)/(T3+273.15))
    h4 = h3 + Cp_comb*(T4-T3)

    # isentropic exhaust
    s4_si = s4*1000
    T5is_K = CP.PropsSI("T","Smass",s4_si,"P",P1*100,"Air")
    T5is = T5is_K-273.15
    h5is = CP.PropsSI("Hmass","T",T5is_K,"P",P1*100,"Air")/1000

    Cp_exp = exhaust_cp((T4+T5)/2)
    s5 = s4 + Cp_exp*math.log((T5+273.15)/(T4+273.15))
    h5 = h4 + Cp_exp*(T5-T4)

    # curves
    def curve_c_is():
        pts=[]
        for P in np.linspace(P1,P3,20):
            T_K=CP.PropsSI("T","Smass",s1*1000,"P",P*100,"Air")
            pts.append({"s":round(CP.PropsSI("Smass","T",T_K,"P",P*100,"Air")/1000,4),
                        "T":round(T_K-273.15,1),
                        "h":round(CP.PropsSI("Hmass","T",T_K,"P",P*100,"Air")/1000,2),
                        "P":round(P/100,3)})
        return pts
    def curve_c_act():
        return [{"s":round(s1+f*(s3-s1),4),"T":round(T1+f*(T3-T1),1),
                 "h":round(h1+f*(h3-h1),2),"P":round((P1+f*(P3-P1))/100,3)}
                for f in np.linspace(0,1,20)]
    def curve_comb():
        return [{"s":round(s3+Cp_comb*math.log(max((T3+f*(T4-T3)+273.15)/(T3+273.15),1e-6)),4),
                 "T":round(T3+f*(T4-T3),1),
                 "h":round(h3+Cp_comb*(T3+f*(T4-T3)-T3),2),
                 "P":round(P3/100,3)}
                for f in np.linspace(0,1,20)]
    def curve_exp_is():
        pts=[]
        for P in np.linspace(P3,P1,20):
            T_K=CP.PropsSI("T","Smass",s4_si,"P",P*100,"Air")
            pts.append({"s":round(s4,4),"T":round(T_K-273.15,1),
                        "h":round(CP.PropsSI("Hmass","T",T_K,"P",P*100,"Air")/1000,2),
                        "P":round(P/100,3)})
        return pts
    def curve_exp_act():
        return [{"s":round(s4+Cp_exp*math.log(max((T4+f*(T5-T4)+273.15)/(T4+273.15),1e-6)),4),
                 "T":round(T4+f*(T5-T4),1),
                 "h":round(h4+Cp_exp*(T4+f*(T5-T4)-T4),2),
                 "P":round((P3+f*(P1-P3))/100,3)}
                for f in np.linspace(0,1,20)]

    return {
        "states": {
            "1":   {"T":T1,   "s":round(s1,4),   "h":round(h1,2),   "P":round(P1/100,3)},
            "3is": {"T":round(T3is,2),"s":round(s3is,4),"h":round(h3is,2),"P":round(P3/100,3)},
            "3":   {"T":round(T3,2),  "s":round(s3,4),  "h":round(h3,2),  "P":round(P3/100,3)},
            "4":   {"T":round(T4,1),  "s":round(s4,4),  "h":round(h4,2),  "P":round(P3/100,3)},
            "5is": {"T":round(T5is,1),"s":round(s4,4),  "h":round(h5is,2),"P":round(P1/100,3)},
            "5":   {"T":T5,   "s":round(s5,4),   "h":round(h5,2),   "P":round(P1/100,3)},
        },
        "curves": {
            "compress_is":  curve_c_is(),
            "compress_act": curve_c_act(),
            "combustion":   curve_comb(),
            "expand_is":    curve_exp_is(),
            "expand_act":   curve_exp_act(),
        }
    }


def _oem_curves():
    """Return OEM curve arrays for gas and oil."""
    gas = [{"T_CI": t, "P_GT": v[0], "T_TII": v[1]} for t, v in sorted(OEM_CURVE_GAS.items())]
    oil = [{"T_CI": t, "P_GT": v[0], "T_TII": v[1]} for t, v in sorted(OEM_CURVE_OIL.items())]
    return {"gas": gas, "oil": oil}


def _filter_curves():
    """ΔP vs hours for each stage (0 → life_hours)."""
    import numpy as np
    result = {}
    for stage, d in FILTER_STAGES.items():
        hrs = np.linspace(0, d["life_hours"], 60).tolist()
        dp  = [(d["dp_initial_Pa"] + (d["dp_final_Pa"]-d["dp_initial_Pa"])*h/d["life_hours"])/100
               for h in hrs]
        result[stage] = {
            "hours": [round(h,0) for h in hrs],
            "dp_hPa": [round(v,3) for v in dp],
            "life_hours": d["life_hours"],
            "dp_initial_hPa": d["dp_initial_Pa"]/100,
            "dp_final_hPa":   d["dp_final_Pa"]/100,
        }
    return result


def _comp_eff_curves():
    """Compressor T3 and Wc vs T_CI for multiple efficiency lines."""
    etas = [0.82, 0.84, 0.86, 0.875, 0.89, 0.91]
    T_CIs = list(range(5, 46, 5))
    out = []
    for eta in etas:
        pts = []
        for tci in T_CIs:
            cs = compressor_state(tci, 1010.75, eta, PR_DESIGN)
            pts.append({"T_CI": tci, "T3": round(cs["T3_C"],1), "Wc": round(cs["W_c_kJ_kg"],1)})
        out.append({"eta": eta, "points": pts})
    return out


# ── Endpoints ─────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "plant": "Sirajganj 150MW", "gt": "SGT5-2000E"}

@app.get("/static-data")
def static_data():
    """Return all static curve data needed to pre-populate charts."""
    return {
        "oem_curves":       _oem_curves(),
        "filter_curves":    _filter_curves(),
        "comp_eff_curves":  _comp_eff_curves(),
        "design_point": {
            "T_CI": T_AMB_DESIGN, "P_amb": P_AMB_0, "RH": RH_DESIGN,
            "P_GT_MW": P_GT_DESIGN_GAS, "m_fuel_kgs": M_FUEL_DESIGN_GAS,
            "LHV": LHV_GAS,
        }
    }

@app.post("/solve/mode1")
def solve_mode1(req: Mode1Request):
    LHV, ratio = _defaults(req.fuel, req.LHV, req.HHV_LHV_ratio)
    try:
        gt = mode1_solve(
            T_CI=req.T_CI, P_amb=req.P_amb, RH_pct=req.RH_pct,
            P_GT_actual_MW=req.P_GT_actual_MW,
            fuel=req.fuel, LHV=LHV, HHV_LHV_ratio=ratio,
            m_fuel_actual=req.m_fuel_actual,
            hours_coalescer=req.hours_coalescer,
            hours_prefilter=req.hours_prefilter,
            hours_finefilter=req.hours_finefilter,
            eta_c_is=req.eta_c_is, PR=req.PR,
        )
        gt["P_GT_actual_MW"] = req.P_GT_actual_MW
        bal = full_balance(gt, n_gbc_units=req.n_gbc_units, P_rms_bar=req.P_rms_bar, fuel=req.fuel)
        ts  = _ts_points(gt)
        return {"gt": gt, "balance": bal, "thermo": ts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/solve/mode2")
def solve_mode2(req: Mode2Request):
    LHV, ratio = _defaults(req.fuel, req.LHV, req.HHV_LHV_ratio)
    try:
        gt = mode2_solve(
            T_CI=req.T_CI, P_amb=req.P_amb, RH_pct=req.RH_pct,
            m_fuel_kgs=req.m_fuel_kgs,
            fuel=req.fuel, LHV=LHV, HHV_LHV_ratio=ratio,
            hours_coalescer=req.hours_coalescer,
            hours_prefilter=req.hours_prefilter,
            hours_finefilter=req.hours_finefilter,
            eta_c_is=req.eta_c_is, PR=req.PR,
        )
        bal = full_balance(gt, n_gbc_units=req.n_gbc_units, P_rms_bar=req.P_rms_bar, fuel=req.fuel)
        ts  = _ts_points(gt)
        return {"gt": gt, "balance": bal, "thermo": ts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/filter/dp")
def filter_dp(req: FilterRequest):
    from core.gt_model import filter_delta_p
    return filter_delta_p(req.hours_coalescer, req.hours_prefilter, req.hours_finefilter)
