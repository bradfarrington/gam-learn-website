let n;
var l = (o) => {
    if (!n) {
        const r = o.forwardRef(({color: i = "currentColor", size: e = 24, ...s}, t) => {
            return o.createElement("svg", {ref: t, xmlns: "http://www.w3.org/2000/svg", width: e, height: e, viewBox: "0 0 24 24", fill: "none", stroke: i, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", ...s}, o.createElement("polyline", {points: "7 13 12 18 17 13"}), o.createElement("polyline", {points: "7 6 12 11 17 6"}));
        });
        r.displayName = "ChevronsDown",n = r;
    }
    return n;
};
const __GlearnMetadata__ = {exports: {default: {type: "reactComponent", slots: [], annotations: {glearnContractVersion: "1"}}, __GlearnMetadata__: {type: "variable"}}};
export { __GlearnMetadata__, l as default };