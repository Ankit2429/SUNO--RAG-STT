from eval.http_target import generate_answer

ans = generate_answer("What is a corporation according to state laws?", [])
print("Answer text:", ans.text)
print("Grounded:", ans.grounded)
print("Latency ms:", ans.generation_ms)
print("Model:", ans.model)
