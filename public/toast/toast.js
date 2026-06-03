(function injectStyles() {
  const s = document.createElement("style");
  s.textContent = `
    @keyframes toastDropIn {
      0%   { opacity:0; transform:translateY(-32px) scale(.3) }
      100% { opacity:1; transform:translateY(0)     scale(1)  }
    }
    @keyframes toastRiseOut {
      0%   { opacity:1; transform:translateY(0)     scale(1)  }
      100% { opacity:0; transform:translateY(-32px) scale(.3) }
    }
    .toast-drop { animation: toastDropIn  .38s cubic-bezier(.22,1,.36,1) forwards }
    .toast-rise { animation: toastRiseOut .32s cubic-bezier(.55,0,1,.45) forwards }
    .toast-text { overflow:hidden; white-space:nowrap;
                  max-width:0; display:inline-block }
  `;
  document.head.appendChild(s);
})();

let _autoTimer, _typeTimer, _eraseTimer, _phase = "idle";

function _typeWriter(text, el, i, done) {
  el.textContent = text.slice(0, i);
  el.style.maxWidth = i === 0 ? "0px" : i * 8.5 + 4 + "px";
  if (i <= text.length)
    _typeTimer = setTimeout(() => _typeWriter(text, el, i + 1, done), 5);
  else done && done();
}

function _eraseWriter(el, done) {
  const text = el.textContent;
  let i = text.length;
  (function step() {
    el.textContent = text.slice(0, i);
    el.style.maxWidth = i === 0 ? "0px" : i * 8.5 + 4 + "px";
    if (i-- >= 0) _eraseTimer = setTimeout(step, 5);
    else done && done();
  })();
}

window.showToast = function (type, message) {
  const colors = { info:"#3b82f6", success:"#10b981", error:"#ef4444" };
  const icons  = { info:"ℹ",       success:"✓",       error:"!"  };

  clearTimeout(_autoTimer);
  clearTimeout(_typeTimer);
  clearTimeout(_eraseTimer);
  _phase = "idle";

  Swal.fire({
    toast: true,
    position: "top",
    showConfirmButton: false,
    timerProgressBar: false,
    background: "#0b0b0b",
    color: "#fff",
    width: "auto",
    showClass: { popup: "toast-drop" },
    hideClass:  { popup: "" },          // we handle hide manually
    didOpen: (popup) => {
      _phase = "typing";
      const msgEl = popup.querySelector(".swal2-html-container span.toast-text");
      _typeWriter(message, msgEl, 0, () => {
        _phase = "visible";
        _autoTimer = setTimeout(() => window.hideToast(), 3000);
      });
    },
    html: `
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:7px;height:7px;border-radius:50%;
                    background:${colors[type]};
                    box-shadow:0 0 7px ${colors[type]}"></div>
        <span style="
          display:inline-flex;align-items:center;justify-content:center;
          width:15px;height:15px;border-radius:50%;
          border:1.5px solid ${colors[type]};
          color:${colors[type]};font-size:9px;font-weight:700">
          ${icons[type]}
        </span>
        <span class="toast-text" style="font-size:12px;font-weight:500;color:#fff"></span>
      </div>`,
    customClass: {
      popup: "!rounded-full !px-3 !py-2 !border !border-white/10"
    }
  });
};

window.hideToast = function () {
  clearTimeout(_autoTimer);
  clearTimeout(_typeTimer);
  clearTimeout(_eraseTimer);
  const popup = document.querySelector(".swal2-toast");
  if (!popup) return;
  const msgEl = popup.querySelector("span.toast-text");
  _eraseWriter(msgEl, () => {
    popup.classList.add("toast-rise");
    popup.addEventListener("animationend", () => Swal.close(), { once: true });
  });
};