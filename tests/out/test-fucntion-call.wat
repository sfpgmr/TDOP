(module
 (type $𩸽 (func (param none none) (result i32)))
 (type $main (func (result i32)))
 (export "main" (func $main))
 (func $𩸽 (; 0 ;) (type $𩸽) (param $0 none) (param $1 none) (result i32)
  (return
   (i32.mul
    (get_local $0)
    (get_local $1)
   )
  )
 )
 (func $main (; 1 ;) (type $main) (result i32)
  (local $0 i32)
  (set_local $0
   (i32.const 2)
  )
  (return
   (call $𩸽
    (get_local $0)
    (get_local $0)
   )
  )
 )
)
