let r;
var l = (o) => {
    if (!r) {
        const e = o.forwardRef(({color: t = "currentColor", size: n = 24, ...i}, s) => {
            return o.createElement("svg", {ref: s, xmlns: "http://www.w3.org/2000/svg", width: n, height: n, viewBox: "0 0 24 24", fill: "none", stroke: t, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", ...i}, o.createElement("polyline", {points: "15 18 9 12 15 6"}));
        });
        e.displayName = "ChevronLeft",r = e;
    }
    return r;
};
const __GlearnMetadata__ = {exports: {default: {type: "reactComponent", slots: [], annotations: {glearnContractVersion: "1"}}, __GlearnMetadata__: {type: "variable"}}};
export { __GlearnMetadata__, l as default };