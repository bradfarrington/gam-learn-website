let n;
var l = (o) => {
    if (!n) {
        const r = o.forwardRef(({color: t = "currentColor", size: e = 24, ...i}, s) => {
            return o.createElement("svg", {ref: s, xmlns: "http://www.w3.org/2000/svg", width: e, height: e, viewBox: "0 0 24 24", fill: "none", stroke: t, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", ...i}, o.createElement("polyline", {points: "6 9 12 15 18 9"}));
        });
        r.displayName = "ChevronDown",n = r;
    }
    return n;
};
const __GlearnMetadata__ = {exports: {default: {type: "reactComponent", slots: [], annotations: {glearnContractVersion: "1"}}, __GlearnMetadata__: {type: "variable"}}};
export { __GlearnMetadata__, l as default };