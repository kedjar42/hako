# Lesson 01: The mystery password

**Goal:** find the password of `mystery`, a stripped Linux program, without
looking at `mystery.c`. (The source is only here so you can check the answer.)

Try it: `./mystery test` prints `Wrong password.`

## Step 1: Identify the file

```bash
file mystery
```

It's a 64-bit Linux ELF program, and it's **stripped**, so the function names
are gone. That makes it a little harder, but not much.

## Step 2: Look for readable text

```bash
strings -n 5 mystery
```

We see `usage: mystery <password>`, `Wrong password.` and
`Access granted. Well done!`, but no password. So it's **hidden or encoded**.

## Step 3: See which library functions it calls

```bash
objdump -T mystery
```

It only uses `puts` (print text) and `strlen` (measure a string's length). So
there's no `strcmp`: the program compares the password itself, by hand.

## Step 4: Disassemble and read the check

```bash
objdump -d -M intel mystery
```

Find the `call strlen` and read what comes after it:

```asm
call   strlen                  ; length of what you typed
cmp    rax,0x7                 ; must be 7 characters
jne    WRONG
lea    rcx,[0x2050]            ; rcx = hidden data at address 0x2050
LOOP:
movzx  edx,BYTE PTR [rbx+rax]  ; take your character i
xor    edx,0x2a                ; XOR it with 0x2A
cmp    dl,BYTE PTR [rcx+rax]   ; compare with hidden byte i
jne    WRONG
add    rax,1
cmp    rax,7
jne    LOOP
; all matched: puts("Access granted...")
```

In plain words: **for each character, `input[i] XOR 0x2A` must equal `hidden[i]`.**

## Step 5: Reverse the math

XOR undoes itself: if `a ^ k = b`, then `a = b ^ k`. Read the 7 hidden bytes
and XOR them with 0x2A:

```bash
python3 -c "d=open('mystery','rb').read()[0x2050:0x2057]; print(bytes(b^0x2A for b in d))"
```

Result: **`hako123`**

```bash
./mystery hako123   # Access granted. Well done!
```

## What to remember

1. Start cheap: `file`, then `strings`, then the imports.
2. Find the place where the program decides (here, after `strlen`).
3. Turn the assembly into one plain sentence.
4. Reverse that sentence to get the answer.
