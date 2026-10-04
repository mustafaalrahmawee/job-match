# Fassung v1

Laufzeit (Varianten parallel): 743.9 s

| Variante | Aufrufe | Input-Tokens | Output-Tokens | Ø Output/Aufruf | Kosten | Zeit gesamt | Ø Zeit/Aufruf | längster Aufruf |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| glm-5.3-flash · low | 21 | 5934 | 6495 | 309 | $0.0041 | 198.6 s | 9.5 s | 09-discouragement (18.2 s) |
| glm-5.3-flash · high | 21 | 5742 | 30876 | 1470 | $0.0163 | 743.9 s | 35.4 s | 12-pasted-job-ad (79.2 s) |
| glm-5.3 · low | 21 | 5934 | 7013 | 334 | $0.0392 | 129.9 s | 6.2 s | 12-pasted-job-ad (9.8 s) |
| glm-5.3 · high | 21 | 5742 | 23116 | 1101 | $0.1097 | 343.8 s | 16.4 s | 16-legal-question (42.1 s) |
