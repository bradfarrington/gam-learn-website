let r;
var l = (o) => {
    if (!r) {
        const n = o.forwardRef(({color: i = "currentColor", size: e = 24, ...t}, w) => {
            return o.createElement("svg", {ref: w, xmlns: "http://www.w3.org/2000/svg", width: e, height: e, viewBox: "0 0 24 24", fill: "none", stroke: i, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", ...t}, o.createElement("line", {x1: "12", y1: "5", x2: "12", y2: "19"}), o.createElement("polyline", {points: "19 12 12 19 5 12"}));
        });
        n.displayName = "ArrowDown",r = n;
    }
    return r;
};
const __GlearnMetadata__ = {exports: {default: {type: "reactComponent", slots: [], annotations: {glearnContractVersion: "1"}}, __GlearnMetadata__: {type: "variable"}}};
export { __GlearnMetadata__, l as default };