let n;
var l = (o) => {
    if (!n) {
        const r = o.forwardRef(({color: i = "currentColor", size: e = 24, ...s}, t) => {
            return o.createElement("svg", {ref: t, xmlns: "http://www.w3.org/2000/svg", width: e, height: e, viewBox: "0 0 24 24", fill: "none", stroke: i, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", ...s}, o.createElement("polyline", {points: "17 11 12 6 7 11"}), o.createElement("polyline", {points: "17 18 12 13 7 18"}));
        });
        r.displayName = "ChevronsUp",n = r;
    }
    return n;
};
const __GlearnMetadata__ = {exports: {default: {type: "reactComponent", slots: [], annotations: {glearnContractVersion: "1"}}, __GlearnMetadata__: {type: "variable"}}};
export { __GlearnMetadata__, l as default };