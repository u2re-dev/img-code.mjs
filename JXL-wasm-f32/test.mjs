import { loadJXL } from "./lib/wrapper.mjs";

//
const main = async ()=>{
    const canvas = document.querySelector("#canvas");
    const ctx = canvas?.getContext?.("2d", { colorSpace: "display-p3" });
    const img = await loadJXL?.('./img/test.jxl');
    if (canvas) {
        canvas.width  = img.width;
        canvas.height = img.height;
        canvas.style.inlineSize = (canvas.width / 2) + "px";
        canvas.style.blockSize = (canvas.height / 2) + "px";
    }
    ctx.putImageData(img, 0, 0);
}

//
main();
