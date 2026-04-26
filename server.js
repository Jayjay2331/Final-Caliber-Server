<script>
let socket = new WebSocket("wss://final-caliber-server.onrender.com");

socket.onopen = () => log("Connected to server", "system");

socket.onmessage = (event) => {
    try {
        let msg = JSON.parse(event.data);

        if (msg.type === "system") {
            log("[SYSTEM] " + msg.msg, "system");
        }

        if (msg.type === "update") {
            log("[PLAYER] " + msg.id + " updated", "server");
        }

        if (msg.type === "error") {
            log("[ERROR] " + msg.msg, "error");
        }

    } catch {
        log(event.data, "server");
    }
};

socket.onclose = () => log("Disconnected", "error");

function send() {
    let input = document.getElementById("cmd");
    let msg = input.value;

    if (!msg) return;

    socket.send(msg);
    log("> " + msg, "sent");

    input.value = "";
}

function log(text, type) {
    let out = document.getElementById("output");

    let div = document.createElement("div");
    div.className = "msg " + type;
    div.textContent = text;

    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
}
</script>
