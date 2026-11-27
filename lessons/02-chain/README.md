# Lesson 02: The chain (you lead)

**Goal:** find the password that makes `chain` print `ACCESS GRANTED`.

This time there's **no source code**. You run the commands, tell Claude what
you find, and Claude only gives hints when you ask.

```bash
cd lessons/02-chain
./chain hello      # Wrong password.
```

## Rules

- Use the same method as Lesson 01: `file`, then `strings`, then the imports,
  then the disassembly, then reverse the math.
- Paste your outputs and ideas to Claude. Ask "why?" whenever you're stuck on
  an assembly line.
- Only open a hint if you've been stuck for a while. Fewer hints means more points.

## What's new in this lesson

1. **A trap.** Something in this program wants to waste your time.
2. **A chain.** Each character's check depends on the character **before** it.
   You'll need to solve the characters **in order**, from first to last.

## Assembly cheat sheet

| Instruction    | Meaning                                        |
|----------------|------------------------------------------------|
| `mov a, b`     | a = b                                          |
| `movzx a, [x]` | a = the byte at address x                      |
| `xor a, b`     | a = a XOR b                                    |
| `add a, b`     | a = a + b                                      |
| `cmp a, b`     | compare a and b (for the next jump)            |
| `jne X`        | jump to X if they were **not** equal           |
| `lea r, [addr]`| r = an address (often a table or a string)     |
| `dl`           | the lowest byte of `edx`                       |

## Hints (open one at a time)

<details><summary>Hint 1: Where to start</summary>

`strings` shows something that looks like a password. Try it. What happens?
Then look at the imports. There are **two** ways the program checks your input.

</details>

<details><summary>Hint 2: Finding the real check</summary>

Run `objdump -d -M intel chain` and look right after `call strlen`. How long
must the password be? Which address holds the hidden table?

</details>

<details><summary>Hint 3: Two registers matter</summary>

Inside the loop, `eax` is the position `i` (0, 1, 2...). `ecx` starts at a
special value **before** the loop, and then it changes. What does it hold
on the next round?

</details>

<details><summary>Hint 4: The math, in words</summary>

For each position i: `(your_char XOR previous) + i` must equal `table[i]`.
At the start, "previous" is a fixed number. After each round, "previous" is
your character.

</details>

<details><summary>Hint 5: Reversing it</summary>

Undo the steps backwards: first subtract `i`, then XOR with "previous".
That gives `your_char`. It then becomes "previous" for the next position.

</details>

## When you're done

Run `./chain <your answer>`, then tell Claude your answer and **how** you got
it. Explaining it back is the real test.
