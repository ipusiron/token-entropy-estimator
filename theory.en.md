# Token Entropy Estimator: Theory Notes

This document summarizes the **entropy calculations** and the **theory behind the strength estimates** used inside `Token Entropy Estimator`.

It goes into the mathematical and information-theoretic parts, with diagrams to make them intuitive.

---

## 1. What is entropy?

### 1.1 Definition of information entropy
In information theory, **entropy** measures the "uncertainty" of a probability distribution.

```
H(X) = -∑(i=1 to n) p_i × log₂(p_i)
```

- X: random variable (a set of characters or symbols)
- p_i: probability that each character appears
- Unit: bit

---

### 1.2 Intuition

```
Character set Σ
├── 'a' (25%) → p=0.25
├── 'b' (25%) → p=0.25
├── 'c' (25%) → p=0.25
└── 'd' (25%) → p=0.25
↓
H = 2.0 bits (fully random)
```

👉 Entropy is largest when every character is equally likely, and smaller when they are skewed.

---

## 2. The estimate used by this tool

### 2.1 Assuming a uniform distribution
If the input was "chosen n times independently from an alphabet of size |Σ|":

```
H_est = n × log₂(|Σ|)
```

Example:
- 62 alphanumeric characters × 16 characters
  **H ≈ 16 × log₂(62) ≈ 95.3 bits**

```
62 alphanumeric characters
[0-9][a-z][A-Z]
↓
16 characters long
↓
H ≈ 95 bits
```

---

### 2.2 Shannon entropy (for reference)
Computed from the character frequencies in the input:

```
H_emp = (-∑ p_i × log₂(p_i)) × n
```

- Random string → close to H_est
- Skewed string (e.g. aaaaaaaa…) → H_emp ≪ H_est

---

## 3. The brute-force model

### 3.1 Search space
```
|Σ|ⁿ = 2^H_est
```

Example: 62 alphanumeric characters × 8 characters

Search space = 62^8 ≈ 2.18e14

### 3.2 Average number of guesses

With N = |Σ|ⁿ candidates tried one by one without repeats, a hit takes (N+1)/2 guesses on average.
If K valid values are in use at the same time and hitting any one of them is enough, it takes (N+1)/(K+1) guesses on average and N−K+1 at worst.

```
N_guess ≈ |Σ|ⁿ / 2 ((N+1)/(K+1) with K valid values)
```

The example in the OWASP Session Management Cheat Sheet (100,000 session IDs of 64 bits in use, 10,000 guesses per second) gives about 585 years with this formula.

### 3.3 Brute-force time
```
T ≈ (|Σ|ⁿ / 2) / R
```

- R = attack rate (e.g. 10⁹ guesses/sec)

```
H = 95 bits
search space = 2^95 ≈ 4e28
average guesses = 2^94 ≈ 2e28
R = 1e9/sec
→ estimated time ≈ 2e19 seconds ≈ 6.3e11 years (about 630 billion years)
```

---

## 4. The random part of each UUID version

The UUID format is defined by RFC 9562 (2024, which replaced RFC 4122).

```
UUID v4 = 128 bits, but…
├─ version field = fixed to 4 (4 bits)
└─ variant field = fixed to 10 (2 bits)
↓
random part = 122 bits

UUID v7 = 48-bit timestamp in milliseconds + 74 random bits (rand_a 12 bits + rand_b 62 bits)
↓
random part = 74 bits (the time can be read and guessed)
```

Versions 1 and 6 are made from a timestamp and a device number, and versions 3 and 5 from the hash of a name, so they cannot be used as secrets. The tool reads the version and counts 122 bits for v4 and 74 bits for v7.

---

## 5. Standards

The tool takes its standards from published guidance.

| Standard | Bits | Source |
|----------|------|--------|
| Session ID | 64 | OWASP Session Management Cheat Sheet, NIST SP 800-63B-4 |
| Long-lived key (through 2030) | 112 | NIST SP 800-57 Part 1 Rev. 5, Table 4 |
| Long-lived key (from 2031) | 128 | NIST SP 800-57 Part 1 Rev. 5, Table 4 |
| One-time password key | 160 | RFC 4226 (at least 128 bits required, 160 bits recommended) |
| JWT HS256 key | 256 | RFC 7518 3.2 |

With 62 alphanumeric characters, 128 bits need 22 characters and 256 bits need 43. With hexadecimal, they need 32 and 64.

---

## 6. Comparing many tokens (min-entropy)

A single string does not tell you how it was made. Lining up many tokens made the same way lets you compare how characters appear at each position (the idea behind Burp Suite Sequencer).

```
share of the most common character at position i: p_max(i)
min-entropy H_min(i) = −log₂ p_max(i)
```

- With truly random tokens, every position has about the same value
- Counters, timestamps and fixed prefixes bring the value of those positions close to 0
- With n tokens, a position cannot exceed log₂(n). With 100 tokens the maximum is about 6.64 bits, and even for alphanumerics (log₂62≈5.95) the guide for random tokens is about 4.3 bits. The tool shows, as the "guide", the average of 200 trials with random strings of the same count and the same set size

---

## 7. Making tokens (modulo bias and rejection sampling)

If a character is chosen by taking the remainder of one byte (0-255) divided by the set size k, and 256 is not divisible by k, the first (256 mod k) characters appear one extra time.

```
k = 62: 256 = 62 × 4 + 8
→ the first 8 characters have 5/256, the rest 4/256 (a 1.25× difference)
→ min-entropy drops by log₂62 − log₂(256/5) ≈ 0.276 bits per character (about 8.84 bits for 32 characters)
```

Hexadecimal (16), Base32 (32) and Base64 (64) divide 256, so they have no bias. To avoid the bias, discard values of 248 or more (for k=62) and draw again (rejection sampling). Use a cryptographic random generator (crypto.getRandomValues in a browser), not Math.random.

---

## 8. Notes

- The calculations assume an "ideal uniform random generator"
- The true entropy cannot be estimated exactly from a single sample. The tool only reports structure that is unlikely to happen by chance (repeated characters, runs, readable content)
- The Shannon entropy of a string (computed from character frequencies) cannot exceed log₂(n) for length n. It is not the entropy of how the string was made
- Brute force by a quantum computer (Grover's search) takes roughly the square root of the guesses. As a rough guide, the strength becomes that of half the bits

👉 This is an estimation tool for **education and design support** only

---

## 9. References
- C. E. Shannon, *A Mathematical Theory of Communication*, 1948
- RFC 9562: Universally Unique IDentifiers (UUIDs) (replaced RFC 4122)
- NIST SP 800-63B-4: Digital Identity Guidelines – Authentication and Authenticator Management
- NIST SP 800-57 Part 1 Rev. 5: Recommendation for Key Management
- RFC 4226: HOTP, RFC 7518: JSON Web Algorithms
- OWASP Session Management Cheat Sheet
- PortSwigger, Burp Suite Sequencer documentation
