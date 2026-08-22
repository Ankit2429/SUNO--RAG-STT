import os
from pathlib import Path
from dotenv import dotenv_values

env_vars = dotenv_values(Path(__file__).parent.parent / ".env")
print("Keys in .env:", list(env_vars.keys()))
