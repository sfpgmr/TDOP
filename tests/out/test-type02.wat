(module
 (type $main (func (result i32)))
 (export "main" (func $main))
 (func $main (; 0 ;) (type $main) (result i32)
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (set_local $0
   (i32.const 10)
  )
  (set_local $1
   (i32.const 2)
  )
  (set_local $2
   (i32.const 10)
  )
  (set_local $3
   (i32.const 2)
  )
  (set_local $0
   (i32.const 3)
  )
  (set_local $1
   (i32.const 4)
  )
  (block
   (set_local $2
    (get_local $0)
   )
   (set_local $3
    (get_local $1)
   )
  )
  (return
   (i32.mul
    (get_local $2)
    (get_local $1)
   )
  )
 )
)
