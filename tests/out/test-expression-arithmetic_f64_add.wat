(module
 (type $main (func (result f64)))
 (export "main" (func $main))
 (func $main (; 0 ;) (type $main) (result f64)
  (local $0 f64)
  (local $1 f64)
  (set_local $0
   (f64.const 3)
  )
  (set_local $1
   (f64.const 2)
  )
  (return
   (f64.add
    (get_local $0)
    (get_local $1)
   )
  )
 )
)
