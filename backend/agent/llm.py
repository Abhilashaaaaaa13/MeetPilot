import os
from typing import Optional

from langchain_groq import ChatGroq



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
    ) -> None:
        self.model_name = model_name or os.getenv("MODEL_NAME", "openai/gpt-oss-120b")
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        self.base_url = base_url or os.getenv("GROQ_BASE_URL")
        self.temperature = temperature

    def create(self):
        if not self.api_key or ChatGroq is None:
            return MockLLM(model_name=self.model_name)

        return ChatGroq(
            model=self.model_name,
            api_key=self.api_key,
            base_url=self.base_url,
            temperature=self.temperature,
        )


def get_llm(
    model_name: Optional[str] = None,
    api_key: Optional[str] = None,
    base_url: Optional[str] = None,
    temperature: float = 0.2,
):
    return LLMFactory(
        model_name=model_name,
        api_key=api_key,
        base_url=base_url,
        temperature=temperature,
    ).create()
