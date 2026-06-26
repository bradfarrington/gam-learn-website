let o;
var s = (r) => {
    if (!o) {
        const n = r.forwardRef(({color: i = "currentColor", size: e = 24, ...t}, l) => {
            return r.createElement("svg", {ref: l, xmlns: "http://www.w3.org/2000/svg", width: e, height: e, viewBox: "0 0 24 24", fill: "none", stroke: i, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", ...t}, r.createElement("line", {x1: "12", y1: "19", x2: "12", y2: "5"}), r.createElement("polyline", {points: "5 12 12 5 19 12"}));
        });
        n.displayName = "ArrowUp",o = n;
    }
    return o;
};
const __GlearnMetadata__ = {exports: {default: {type: "reactComponent", slots: [], annotations: {glearnContractVersion: "1"}}, __GlearnMetadata__: {type: "variable"}}};
export { __GlearnMetadata__, s as default };