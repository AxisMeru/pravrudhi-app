"""#633 S4: result sentences are generated from the data by template; free text cannot carry a comparative. Stdlib only."""
from bench_tables import cp_interval

def fmt_p(p):
    return f"{p:.3g}"

TEMPLATES = {
    "accuracy": lambda d: f"{d['arm']}, {d['group']}: {d['correct']} of {d['n']} correct ({d['accuracy']:.1%}; exact 95% interval {d['ci95'][0]:.1%} to {d['ci95'][1]:.1%}).",
    "paired_no_separation": lambda d: f"No separation: only {d['first']} right {d['only_first_correct']}, only {d['second']} right {d['only_second_correct']} (exact McNemar p = {fmt_p(d['p'])}{'; Holm-adjusted p = ' + fmt_p(d['holm_adjusted_p']) if d.get('holm_adjusted_p') is not None else ''}).",
    "paired_separated": lambda d: f"Separated: only {d['first']} right {d['only_first_correct']}, only {d['second']} right {d['only_second_correct']} (exact McNemar p = {fmt_p(d['p'])}{'; Holm-adjusted p = ' + fmt_p(d['holm_adjusted_p']) if d.get('holm_adjusted_p') is not None else ''}).",
    "bound": lambda d: f"{d['name']}: {d['value']:.3f} ({d['kind'].replace('_', ' ')}, exact 95%, n = {d['n']}; {d['denominator']}).",
}

def generate(template_id, params):
    return TEMPLATES[template_id](params)
