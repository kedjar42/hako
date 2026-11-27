#include <stdio.h>
#include <string.h>

/* Secret password, XOR-encoded with 0x2A so `strings` can't see it. */
static const unsigned char enc[] = {0x42,0x4B,0x41,0x45,0x1B,0x18,0x19,0x00};

static int check(const char *s) {
    size_t n = sizeof(enc) - 1;
    if (strlen(s) != n) return 0;
    for (size_t i = 0; i < n; i++)
        if ((unsigned char)(s[i] ^ 0x2A) != enc[i]) return 0;
    return 1;
}

int main(int argc, char **argv) {
    if (argc < 2) { puts("usage: mystery <password>"); return 1; }
    if (check(argv[1])) puts("Access granted. Well done!");
    else puts("Wrong password.");
    return 0;
}
