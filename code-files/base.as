; Base assembly file
; This file contains initialization code and constant definitions

; Constants
; Stack pointer optimized for 4-bit signed offset range (-8 to +7)
; With SP=232: accessible range is [224, 239] (16 slots)
; Parameters at SP+0, SP-1, SP-2, ... (up to SP-7)
; Return value at SP+1
; Stays clear of I/O region (240-255)
define STACK_POINTER 232

; Initialize stack pointer (r15) - remains constant throughout execution
LDI r15 STACK_POINTER
