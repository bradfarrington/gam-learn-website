let o;
var s = (r) => {
    if (!o) {
        const n = r.forwardRef(({color: t = "currentColor", size: e = 24, ...i}, l) => {
            return r.createElement("svg", {ref: l, xmlns: "http://www.w3.org/2000/svg", width: e, height: e, viewBox: "0 0 24 24", fill: "none", stroke: t, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", ...i}, r.createElement("line", {x1: "19", y1: "12", x2: "5", y2: "12"}), r.createElement("polyline", {points: "12 19 5 12 12 5"}));
        });
        n.displayName = "ArrowLeft",o = n;
    }
    return o;
};
const __GlearnMetadata__ = {exports: {default: {type: "reactComponent", slots: [], annotations: {glearnContractVersion: "1"}}, __GlearnMetadata__: {type: "variable"}}};
export { __GlearnMetadata__, s as default };