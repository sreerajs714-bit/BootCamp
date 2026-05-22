window.showToast = function (type, message) {

    const colors = {
        success: "#10b981",
        error: "#ef4444",
        warning: "#f59e0b"
    };

    Swal.fire({
        toast: true,
        position: "top-end",
        showConfirmButton: false,
        timer: 3000,

        background: "#0b0b0b",
        color: "#fff",

        width: "260px",

        html: `
            <div class="flex items-center gap-2">

                <div 
                    class="w-2 h-2 rounded-full"
                    style="
                        background:${colors[type]};
                        box-shadow:0 0 8px ${colors[type]};
                    ">
                </div>

                <span class="text-xs font-medium text-white">
                    ${message}
                </span>

            </div>
        `,

        customClass: {
            popup: `
                !rounded-full
                !px-3
                !py-2
                !shadow-xl
                !border
                !border-white/10
            `
        }
    });
};