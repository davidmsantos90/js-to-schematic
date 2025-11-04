; Base assembly file
; This file contains initialization code and constant definitions

; Constants
; 4-bit signed two's complement offset range: -8 to +7

; Stack pointer optimized for 4-bit signed offset range
; With SP=232: accessible range is [232-8, 232+7] = [224, 239] (16 slots)
; Parameters at SP+0, SP-1, SP-2, ... (down to SP-8)
; Return value at SP+1, SP+2, ... (up to SP+7)
; Stays clear of I/O region (240-255)
define STACK_POINTER 232

; With IO=248: accessible range is [248-8, 248+7] = [240, 255] (16 slots)
; Covers entire I/O region (240-255)
define IO_POINTER 248 ; in fact we should have one for each reserved IO memory

; Note: r15 holds the STACK_POINTER value (constant throughout execution)

LDI r15 STACK_POINTER
