               
LDI r1 1     ; v = 1
LDI r2 0     ; prev = 0
LDI r3 1     ; inc = 1
LDI r4 5     ; n = 5
LDI r5 0     ; result = 0

.loop
  CMP r4 r0            ; i < n
  BRANCH == .end_loop  ; n == 0 jump to .end_loop
  ADD r1 r2 r4         ; result = prev + inc
  ADD r2 r0 r1         ; prev = inc;
  ADD r4 r0 r2         ; acc = result 
  JUMP .loop

HALT           