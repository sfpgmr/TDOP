(module
 (type $main (func (result i64)))
 (export "main" (func $main))
 (func $main (; 0 ;) (type $main) (result i64)
  (local $0 i64)
  (local $1 i64)
  (set_local $0
   (i64.const 3)
  )
  (set_local $1
   (i64.const 2)
  )
  (return
   (i64.mul
    (get_local $0)
    (get_local $1)
   )
  )
 )
)
