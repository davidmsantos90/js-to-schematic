; Base assembly file
; This file contains initialization code and constant definitions

; Constants
define STACK_POINTER 239

; Initialize stack pointer (r15) to point to memory just before I/O region
LDI r15 STACK_POINTER
