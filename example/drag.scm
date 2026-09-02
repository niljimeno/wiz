(def init
  {:drag false
   :items ["alpha" "beta" "gamma" "delta" "epsilon"]})

(def item-style
  "padding: 8px 12px; margin: 4px 0; border: 1px solid #ccc; background: #f5f5f5; cursor: grab")

(defn index-of [items item]
  (length (take-while (lambda [x] (/= x item)) items)))

(defn move-item [items from to]
  (let [item (get items from)]
    (if (< from to)
      (concat (take from items)
              (take (- to from) (drop (+ from 1) items))
              [item]
              (drop (+ to 1) items))
      (concat (take to items)
              [item]
              (take (- from to) (drop to items))
              (drop (+ from 1) items)))))

(defn hit [el]
  (if el
    (if (= (el :id) "")
      (hit (el :parentElement))
      el)))

(defn drag-down [event]
  (let [el (hit (event :target))]
    (if el
      (let [b (bounds el)]
        {:type :drag-start
         :id (el :id)
         :dx (- (event :clientX) (b :left))
         :dy (- (event :clientY) (b :top))
         :x (event :clientX)
         :y (event :clientY)}))))

(defn drag-move [event]
  (let [el (hit (element-from-point (event :clientX) (event :clientY)))
        b (if el (bounds el) false)]
    {:type :drag-move
     :x (event :clientX)
     :y (event :clientY)
     :hit (if el (el :id) false)
     :above (if b (< (event :clientY) (+ (b :top) (/ (b :height) 2))) false)}))

(defn update [model action]
  (case (action :type)
    :drag-start (set model :drag
      {:id (action :id)
       :dx (action :dx)
       :dy (action :dy)
       :x (action :x)
       :y (action :y)})
    :drag-move
      (let [d (set (set (model :drag) :x (action :x)) :y (action :y))
            items (model :items)
            hit-id (action :hit)]
        (set (set model :drag d) :items
          (if hit-id
            (move-item items
              (index-of items (d :id))
              (+ (index-of items hit-id) (if (action :above) 0 1)))
            items)))
    :drag-end (set model :drag false)
    model))

(defn item-view [d item]
  (if (and d (= (d :id) item))
    (div {:key item
          :id item
          :style (+ item-style
                    "; background: #ffe9a8; position: fixed; left: 0; top: 0; transform: translate("
                    (- (d :x) (d :dx)) "px, "
                    (- (d :y) (d :dy)) "px); pointer-events: none; z-index: 9; cursor: grabbing")}
      item)
    (div {:key item :id item :style item-style}
      item)))

(defn view [model]
  (let [d (model :drag)]
    (main (if d
            {:on-pointerdown drag-down
             :on-pointermove drag-move
             :on-pointerup {:type :drag-end}
             :on-pointercancel {:type :drag-end}
             :style "user-select: none"
             :touch-action "none"}
            {:on-pointerdown drag-down
             :style "user-select: none"
             :touch-action "none"})
      (h2 "drag to reorder")
      (div
        ,(map (lambda [item] (item-view d item))
          (model :items))))))
