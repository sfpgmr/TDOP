(module
 (type $main (func (result i32)))
 (global $t (mut i32) (i32.const 1))
 (global $p (mut i32) (i32.const 1))
 (global $j (mut i32) (i32.const 0))
 (memory $0 1 0)
 (export "test1" (memory $0))
 (func $main (; 0 ;) (type $main) (result i32)
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
 )
)
