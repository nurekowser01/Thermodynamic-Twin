from typing import Any

_GT_KEYS = (
    "P_GT_actual_MW",
    "P_GT_expected_MW",
    "P_GTM_design_MW",
    "HR_LHV_kJ_kWh",
    "HR_HHV_kJ_kWh",
    "HR_LHV_design_kJ_kWh",
    "eta_LHV_pct",
    "eta_HHV_pct",
    "eta_design_pct",
    "delta_P_MW",
    "delta_P_pct",
    "m_fuel_actual",
    "m_exh_estimated_kgs",
    "T5_TII_oem_C",
    "T4_TIT_C",
    "P_eff_hPa",
    "P_compressor_MW",
)

_COMPRESSOR_KEYS = ("T1_C", "T3_C", "P3_hPa", "eta_c_pct", "W_c_kJ_kg")

_NET_KEYS = ("P_net_MW", "P_GT_MW", "P_aux_total_MW", "P_gbc_MW")

_HEAT_BALANCE_KEYS = ("Q_fuel_MW", "Q_exhaust_MW", "Q_radiation_MW", "eta_th_pct")

_FILTER_KEYS = (
    "dp_coalescer_Pa",
    "dp_prefilter_Pa",
    "dp_finefilter_Pa",
    "dp_total_Pa",
    "dp_total_hPa",
)


def _pick(src: dict[str, Any], keys: tuple[str, ...]) -> dict[str, Any]:
    return {k: src[k] for k in keys if k in src and src[k] is not None}


def slim_plant_context(context: dict[str, Any] | None) -> dict[str, Any] | None:
    if not context:
        return None

    slim: dict[str, Any] = {}
    if context.get("mode") is not None:
        slim["mode"] = context["mode"]
    if context.get("fuel"):
        slim["fuel"] = context["fuel"]
    if context.get("inputs"):
        slim["inputs"] = context["inputs"]

    result = context.get("result")
    if not isinstance(result, dict):
        return slim or None

    gt = result.get("gt") if isinstance(result.get("gt"), dict) else {}
    balance = result.get("balance") if isinstance(result.get("balance"), dict) else {}

    slim_gt = _pick(gt, _GT_KEYS)
    compressor = gt.get("compressor")
    if isinstance(compressor, dict):
        comp_slim = _pick(compressor, _COMPRESSOR_KEYS)
        if comp_slim:
            slim_gt["compressor"] = comp_slim

    slim_balance: dict[str, Any] = {}
    net = balance.get("net_output")
    if isinstance(net, dict):
        net_slim = _pick(net, _NET_KEYS)
        if net_slim:
            slim_balance["net_output"] = net_slim
    hb = balance.get("heat_balance")
    if isinstance(hb, dict):
        hb_slim = _pick(hb, _HEAT_BALANCE_KEYS)
        if hb_slim:
            slim_balance["heat_balance"] = hb_slim

    filter_src = result.get("filter") if isinstance(result.get("filter"), dict) else {}
    if not filter_src and isinstance(gt.get("filter"), dict):
        filter_src = gt["filter"]
    filt_slim = _pick(filter_src, _FILTER_KEYS) if filter_src else {}

    if slim_gt or slim_balance or filt_slim:
        slim["result"] = {}
        if slim_gt:
            slim["result"]["gt"] = slim_gt
        if slim_balance:
            slim["result"]["balance"] = slim_balance
        if filt_slim:
            slim["result"]["filter"] = filt_slim

    return slim or None
