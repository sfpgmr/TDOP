(module
 (type $main (func (result i32)))
 (export "main" (func $main))
 (func $main (; 0 ;) (type $main) (result i32)
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (set_local $0
   (i32.const 1)
  )
  (set_local $1
   (i32.const 2)
  )
  (set_local $2
   (i32.const 1)
  )
  (set_local $3
   (i32.const 2)
  )
  (set_local $2
   (i32.const 10)
  )
  (block
   (set_local $2
    (get_local $2)
   )
   (set_local $3
    (get_local $3)
   )
  )
  (return
   (i32.mul
    (get_local $2)
    (get_local $3)
   )
  )
 )
)
