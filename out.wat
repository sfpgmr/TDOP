(module
 (type $main (func (result i32)))
 (export "main" (func $main))
 (func $main (; 0 ;) (type $main) (result i32)
  (local $0 i32)
  (local $1 i32)
  (set_local $0
   (i32.const 1)
  )
  (set_local $0
   (i32.add
    (get_local $0)
    (tee_local $1
     (i32.const 2)
    )
   )
  )
  (block $L0
   (loop $L1
    (br_if $L0
     (i32.le_s
      (get_local $0)
      (i32.const -3)
     )
    )
    (set_local $0
     (i32.sub
      (get_local $0)
      (i32.const 1)
     )
    )
    (set_local $1
     (i32.add
      (get_local $1)
      (i32.const 1)
     )
    )
    (br $L1)
   )
  )
  (get_local $1)
 )
)
