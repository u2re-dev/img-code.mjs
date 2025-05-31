(module
  ;;(memory (export "memory") 16 8192)
  (import "env" "memory" (memory 1))
  (func (export "mac")
    (param $dst i32)      ;; куда писать RGBA
    (param $src_rgbx i32) ;; откуда брать RGBX
    (param $src_axxx i32) ;; откуда брать AXXX
    (param $len i32)      ;; длина в байтах (кратно 16)
    (local $i i32)
    (local $v_rgbx v128)
    (local $v_axxx v128)
    (local $v_a v128)
    (local $res v128)
    (local $src_idx i32)
    (local $dst_idx i32)
    (local $a_idx i32)
    (block
      (loop
        (br_if 1 (i32.ge_u (local.get $i) (local.get $len)))
        ;; Загрузка 16 байт RGBX и AXXX
        (local.set $v_rgbx (v128.load (i32.add (local.get $src_rgbx) (local.get $i))))
        (local.set $v_axxx (v128.load (i32.add (local.get $src_axxx) (local.get $i))))
        ;; Извлекаем альфу: 0,4,8,12
        (local.set $v_a (i8x16.shuffle 0 4 8 12 0 4 8 12 0 4 8 12 0 4 8 12 (local.get $v_axxx) (local.get $v_axxx)))
        ;; Собираем RGBA: R,G,B из RGBX, A из v_a
        (local.set $res (i8x16.shuffle
            0 1 2 16   ;; R,G,B,A0
            4 5 6 17   ;; R,G,B,A1
            8 9 10 18  ;; R,G,B,A2
            12 13 14 19 ;; R,G,B,A3
            (local.get $v_rgbx) (local.get $v_a)
        ))
        (v128.store (i32.add (local.get $dst) (local.get $i)) (local.get $res))
        (local.set $i (i32.add (local.get $i) (i32.const 16)))
        (br 0)
      )
    )
    ;; Скалярный хвост
    (block
      (loop
        (br_if 1 (i32.ge_u (local.get $i) (local.get $len)))
        (local.set $src_idx (i32.add (local.get $src_rgbx) (local.get $i)))
        (local.set $a_idx (i32.add (local.get $src_axxx) (local.get $i)))
        (local.set $dst_idx (i32.add (local.get $dst) (local.get $i)))
        ;; R
        (i32.store8 (local.get $dst_idx) (i32.load8_u (local.get $src_idx)))
        ;; G
        (i32.store8 (i32.add (local.get $dst_idx) (i32.const 1)) (i32.load8_u (i32.add (local.get $src_idx) (i32.const 1))))
        ;; B
        (i32.store8 (i32.add (local.get $dst_idx) (i32.const 2)) (i32.load8_u (i32.add (local.get $src_idx) (i32.const 2))))
        ;; A
        (i32.store8 (i32.add (local.get $dst_idx) (i32.const 3)) (i32.load8_u (local.get $a_idx)))
        (local.set $i (i32.add (local.get $i) (i32.const 4)))
        (br 0)
      )
    )
  )
  (func (export "wpi")
    (param $dst i32)      ;; Куда писать IDAT
    (param $src i32)      ;; Откуда брать RGBA8
    (param $width i32)    ;; Ширина (пиксели)
    (param $height i32)   ;; Высота (пиксели)
    (result i32)          ;; Возвращает длину чанка

    (local $row_bytes i32)
    (local $total_bytes i32)
    (local $src_idx i32)
    (local $dst_idx i32)
    (local $adler_a i32)
    (local $adler_b i32)
    (local $i i32)
    (local $block_start i32)
    (local $block_len i32)
    (local $left i32)
    (local $is_last i32)
    (local $tmp i32)
    (local $row i32)
    (local $col i32)

    ;; 1. zlib header
    (i32.store8 (local.get $dst) (i32.const 0x78))
    (i32.store8 (i32.add (local.get $dst) (i32.const 1)) (i32.const 0x01))
    (local.set $dst_idx (i32.add (local.get $dst) (i32.const 2)))

    ;; 2. Подсчёт размеров
    (local.set $row_bytes (i32.add (i32.mul (local.get $width) (i32.const 4)) (i32.const 1))) ;; +1 байт фильтра
    (local.set $total_bytes (i32.mul (local.get $row_bytes) (local.get $height)))

    ;; 3. Adler-32 init
    (local.set $adler_a (i32.const 1))
    (local.set $adler_b (i32.const 0))

    ;; 4. Блочная запись
    (local.set $i (i32.const 0))
    (block
      (loop
        (br_if 1 (i32.ge_u (local.get $i) (local.get $total_bytes)))
        ;; Сколько осталось
        (local.set $left (i32.sub (local.get $total_bytes) (local.get $i)))
        (local.set $block_len (select (local.get $left) (i32.const 65535) (i32.lt_u (local.get $left) (i32.const 65536))))
        ;; Последний блок?
        (local.set $is_last (i32.eq (local.get $block_len) (local.get $left)))
        ;; zlib block header
        (i32.store8 (local.get $dst_idx)
          (select (i32.const 1) (i32.const 0) (local.get $is_last)) ;; 1=last, 0=not last
        )
        (i32.store8 (i32.add (local.get $dst_idx) (i32.const 1)) (i32.and (local.get $block_len) (i32.const 0xFF)))
        (i32.store8 (i32.add (local.get $dst_idx) (i32.const 2)) (i32.shr_u (local.get $block_len) (i32.const 8)))
        (i32.store8 (i32.add (local.get $dst_idx) (i32.const 3)) (i32.xor (i32.const 0xFF) (i32.and (local.get $block_len) (i32.const 0xFF))))
        (i32.store8 (i32.add (local.get $dst_idx) (i32.const 4)) (i32.xor (i32.const 0xFF) (i32.shr_u (local.get $block_len) (i32.const 8))))
        (local.set $dst_idx (i32.add (local.get $dst_idx) (i32.const 5)))

        ;; 5. Копируем данные блока (с фильтрами)
        (local.set $block_start (local.get $i))
        (block
          (loop
            (br_if 1 (i32.ge_u (local.get $i) (i32.add (local.get $block_start) (local.get $block_len))))
            ;; Определяем, фильтр или байт данных
            (local.set $tmp (i32.rem_u (local.get $i) (local.get $row_bytes)))
            (if (i32.eqz (local.get $tmp))
              (then
                ;; Фильтр (0)
                (i32.store8 (local.get $dst_idx) (i32.const 0))
                (local.set $dst_idx (i32.add (local.get $dst_idx) (i32.const 1)))
                (local.set $i (i32.add (local.get $i) (i32.const 1)))
              )
              (else
                (local.set $row (i32.div_u (local.get $i) (local.get $row_bytes)))
                (local.set $col (i32.sub (i32.rem_u (local.get $i) (local.get $row_bytes)) (i32.const 1)))
                ;; -1 потому что первый байт строки — фильтр
                (local.set $src_idx
                  (i32.add
                    (local.get $src)
                    (i32.add
                      (i32.mul (local.get $row) (i32.mul (local.get $width) (i32.const 4)))
                      (local.get $col)
                    )
                  )
                )
                (local.set $tmp (i32.load8_u (local.get $src_idx)))
                (i32.store8 (local.get $dst_idx) (local.get $tmp))
                ;; Adler-32
                (local.set $adler_a (i32.add (local.get $adler_a) (local.get $tmp)))
                (local.set $adler_a (i32.and (local.get $adler_a) (i32.const 65535)))
                (local.set $adler_b (i32.add (local.get $adler_b) (local.get $adler_a)))
                (local.set $adler_b (i32.and (local.get $adler_b) (i32.const 65535)))
                (local.set $dst_idx (i32.add (local.get $dst_idx) (i32.const 1)))
                (local.set $i (i32.add (local.get $i) (i32.const 1)))
              )
            )
            (br 0)
          )
        )
        (br 0)
      )
    )

    ;; 6. Adler-32 (big-endian)
    (i32.store8 (local.get $dst_idx) (i32.shr_u (local.get $adler_b) (i32.const 8)))
    (i32.store8 (i32.add (local.get $dst_idx) (i32.const 1)) (i32.and (local.get $adler_b) (i32.const 0xFF)))
    (i32.store8 (i32.add (local.get $dst_idx) (i32.const 2)) (i32.shr_u (local.get $adler_a) (i32.const 8)))
    (i32.store8 (i32.add (local.get $dst_idx) (i32.const 3)) (i32.and (local.get $adler_a) (i32.const 0xFF)))
    (local.set $dst_idx (i32.add (local.get $dst_idx) (i32.const 4)))

    ;; 7. Возврат длины
    (return (i32.sub (local.get $dst_idx) (local.get $dst)))
  )
)
