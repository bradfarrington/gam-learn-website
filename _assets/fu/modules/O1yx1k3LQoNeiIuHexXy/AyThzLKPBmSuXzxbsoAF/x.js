let o;
var s = (r) => {
    if (!o) {
        const n = r.forwardRef(({color: i = "currentColor", size: e = 24, ...t}, l) => {
            return r.createElement("svg", {ref: l, xmlns: "http://www.w3.org/2000/svg", width: e, height: e, viewBox: "0 0 24 24", fill: "none", stroke: i, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", ...t}, r.createElement("line", {x1: "18", y1: "6", x2: "6", y2: "18"}), r.createElement("line", {x1: "6", y1: "6", x2: "18", y2: "18"}));
        });
        n.displayName = "X",o = n;
    }
    return o;
};
const __GlearnMetadata__ = {exports: {default: {type: "reactComponent", slots: [], annotations: {glearnContractVersion: "1"}}, __GlearnMetadata__: {type: "variable"}}};
export { __GlearnMetadata__, s as default };