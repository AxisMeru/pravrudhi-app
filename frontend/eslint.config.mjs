import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", "out/**", "node_modules/**"],
  },
  {
    // The components are copied from AxisMeru/pravrudhi (ADR-0049), where twenty of them call setState inside an
    // effect. That is the source tree's debt, filed there as request r-4dbc4a29 to be fixed at the source; this
    // repository reports it and does not fail on it, so the product's own regressions are what turn CI red.
    rules: { "react-hooks/set-state-in-effect": "warn" },
  },
];

export default eslintConfig;
