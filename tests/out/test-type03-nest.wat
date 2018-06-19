(module
 (type $main (func (result i32)))
 (export "main" (func $main))
 (func $main (; 0 ;) (type $main) (result i32)
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (set_local $0
   (i32.const 1)
  )
  (set_local $1
   (i32.const 2)
  )
  (set_local $2
   (i32.const 3)
  )
  (set_local $3
   (i32.const 4)
  )
  (set_local $4
   (i32.const 1)
  )
  (set_local $5
   (i32.const 2)
  )
  (set_local $6
   (i32.const 3)
  )
  (set_local $7
   (i32.const 4)
  )
  (set_local $0
   (i32.const 2)
  )
  (block
   (set_local $4
    (get_local $0)
   )
   (set_local $5
    (get_local $1)
   )
   (set_local $6
    (get_local $2)
   )
   (set_local $7
    (get_local $3)
   )
  )
  (set_local $0
   (i32.const 10)
  )
  (return
   (i32.mul
    (get_local $0)
    (get_local $4)
   )
  )
 )
)
