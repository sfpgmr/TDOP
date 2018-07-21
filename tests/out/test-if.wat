(module
 (type $main (func (param i32) (result i32)))
 (export "main" (func $main))
 (func $main (; 0 ;) (type $main) (param $0 i32) (result i32)
  (if
   (i32.eq
    (get_local $0)
    (i32.const 1)
   )
   (return
    (i32.const 1)
   )
   (return
    (i32.const 0)
   )
  )
 )
)
