(def init
  {:variable false
   :todo false})

(defn update [model action]
  (case (action :type)
    :change-variable (set model :variable (action :value))
    :todo-loaded (set model :todo (action :value))
    model))

(defn view [model]
  (div
    (button
      {:on-click {:type :change-variable
                  :value (not (model :variable))}}
      "change variable")
    (p (string (model :variable)))
    (button
      {:on-click (httpReq :todo-loaded
        {:url "https://jsonplaceholder.typicode.com/todos/1"})}
      "load todo")
    (if (model :todo)
      (p ((model :todo) :title)))))
