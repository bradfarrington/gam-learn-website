let r;
var t = (n) => {
    if (!r) {
        const o = n.forwardRef(({color: i = "currentColor", size: e = 24, ...l}, s) => {
            return n.createElement("svg", {ref: s, xmlns: "http://www.w3.org/2000/svg", width: e, height: e, viewBox: "0 0 24 24", fill: "none", stroke: i, strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", ...l}, n.createElement("line", {x1: "3", y1: "12", x2: "21", y2: "12"}), n.createElement("line", {x1: "3", y1: "6", x2: "21", y2: "6"}), n.createElement("line", {x1: "3", y1: "18", x2: "21", y2: "18"}));
        });
        o.displayName = "Menu",r = o;
    }
    return r;
};
const __GlearnMetadata__ = {exports: {default: {type: "reactComponent", slots: [], annotations: {glearnContractVersion: "1"}}, __GlearnMetadata__: {type: "variable"}}};
export { __GlearnMetadata__, t as default };