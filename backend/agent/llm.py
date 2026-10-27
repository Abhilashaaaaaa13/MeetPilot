import os
from typing import Optional

try:
    from langchain_groq import ChatGroq
except ImportError:  # lets the app start (with the mock) if the package isn't installed
    ChatGroq = None


class MockLLM:
    def __init__(self, model_name: str = "mock-model") -> None:
        self.model_name = model_name

    def invoke(self, messages):
        last_user_message = ""
        for message in messages:
            if isinstance(message, dict) and message.get("role") == "user":
                last_user_message = str(message.get("content", ""))

        summary = "This is a placeholder response from MeetPilot. Connect the real LLM API key to enable live generation."
        if last_user_message:
            return type("Response", (), {"content": f"{summary}\n\nUser query: {last_user_message}"})()
        return type("Response", (), {"content": summary})()


class LLMFactory:
    def __init__(
        self,
        model_name: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: Optional[int] = None,
        reasoning_effort: Optional[str] = None,
    ) -> None:
        self.model_name = model_name or os.getenv("MODEL_NAME", "openai/gpt-oss-120b")
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        self.base_url = base_url or os.getenv("GROQ_BASE_URL")
        self.temperature = temperature

        # gpt-oss spends output tokens on reasoning BEFORE it writes the answer. Without a
        # cap that is large enough, a long reply gets cut off part-way through a block.
        # If you start seeing 413 / rate-limit errors on your Groq tier, lower this.
        self.max_tokens = max_tokens or int(os.getenv("MAX_OUTPUT_TOKENS", "5000"))
        # "low" keeps reasoning short, which leaves more of the budget for the actual answer
        self.reasoning_effort = reasoning_effort or os.getenv("REASONING_EFFORT", "low")

    def create(self):
        if not self.api_key or ChatGroq is None:
            return MockLLM(model_name=self.model_name)

        kwargs = dict(
            model=self.model_name,
            api_key=self.api_key,
            base_url=self.base_url,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
        )
        if "gpt-oss" in self.model_name and self.reasoning_effort:
            kwargs["reasoning_effort"] = self.reasoning_effort

        return ChatGroq(**kwargs)


def get_llm(
    model_name: Optional[str] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    temperature: float = 0.2,
    max_tokens: Optional[int] = None,
    reasoning_effort: Optional[str] = None,
):
    return LLMFactory(
        model_name=model_name,
        api_key=api_key,
        base_url=base_url,
        temperature=temperature,
        max_tokens=max_tokens,
        reasoning_effort=reasoning_effort,
    ).create()