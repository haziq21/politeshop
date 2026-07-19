import subprocess

from common import VLLM_PORT, hf_cache, vllm_cache, vllm_image, wait_for_port

import modal

MODEL = "HuggingFaceTB/SmolLM2-1.7B-Instruct"
APP_NAME = "politeshop-smollm2-17b"

app = modal.App(APP_NAME)


@app.cls(
    image=vllm_image,
    gpu="T4",
    scaledown_window=120,
    timeout=600,
    volumes={"/root/.cache/huggingface": hf_cache, "/root/.cache/vllm": vllm_cache},
    enable_memory_snapshot=True,
    experimental_options={"enable_gpu_snapshot": True},
)
@modal.concurrent(max_inputs=10)
class Server:
    @modal.enter(snap=True)
    def start(self) -> None:
        self.proc = subprocess.Popen(
            [
                "vllm",
                "serve",
                MODEL,
                "--host",
                "0.0.0.0",
                "--port",
                str(VLLM_PORT),
                "--max-model-len",
                "8192",
                "--gpu-memory-utilization",
                "0.92",
                "--max-num-seqs",
                "4",
                "--max-num-batched-tokens",
                "4096",
                "--served-model-name",
                MODEL,
            ]
        )
        wait_for_port(self.proc, VLLM_PORT)

    @modal.web_server(port=VLLM_PORT, startup_timeout=600, requires_proxy_auth=True)
    def serve(self) -> None:
        pass
