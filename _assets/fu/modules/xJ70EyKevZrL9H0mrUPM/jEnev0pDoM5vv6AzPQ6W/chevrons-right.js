let n;
var l = (o) => {
    if (!n) {
        const r = o.forwardRef(({color: i = "currentColor", size: e = 24, ...t}, s) => {
            return o.createElement("svg", {ref: s, xmlns: "http://www.w3.org/2000/svg", width: e, height: e, viewBox: "0 0 24 24", fill: "none", stroke: i, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", ...t}, o.createElement("polyline", {points: "13 17 18 12 13 7"}), o.createElement("polyline", {points: "6 17 11 12 6 7"}));
        });
        r.displayName = "ChevronsRight",n = r;
    }
    return n;
};
const __GlearnMetadata__ = {exports: {default: {type: "reactComponent", slots: [], annotations: {glearnContractVersion: "1"}}, __GlearnMetadata__: {type: "variable"}}};
export { __GlearnMetadata__, l as default };