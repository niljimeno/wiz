(import "prism")

; html

(defn title-main [title]
  (h1
     {:class "text-4xl font-bold my-4"}
     title))

(defn title-main-sm [title]
  (h2
     {:class "text-3xl font-bold my-4"}
     title))

(defn title [text]
  (h1
   {:class "text-2xl font-bold mt-12"}
   text))

(defn script [text]
    (pre (code
          {:class "language-clojure"}
          text)))

(defn script-sh [text]
    (pre (code
          {:class "language-bash"}
          text)))







; pages

(defn top-bar []
  (header
   (h1
    {:class "font-bold"}
    "Wi")))

(defn not-found []
  (p "404"))




; sidepages

(defn sp-overview []
  (main
   (title-main "Wizard Scheme")
   (p "Wiz or Wizard Scheme is an experimental programming language
       for reactive frontend development with scheme syntax.
       It's not meant for production use.")
   (script "(defn main []
  (print \"hello\"))")
   (title "Core API")
   (p "Not implemented yet")
   ))

(defn sp-setup []
  (main
   (title-main-sm "Setup")
   (p "Installing the language is extremely simple:")
   (script-sh "git clone https://github.com/niljimeno/wizard-scheme
go install")
   (p "Make sure you installed all dependencies before start.")

   (title "Initializing a project")
   (p
    "Using the"
    (script-sh "wiz")
    "command will prompt available options:")
   (script-sh
    "Wiz - usage:
> wiz init :: initialise project
> wiz build :: compile project into target
> wiz live :: live reload project
")
   (p "To create a new project, go to your project's directory and run " (b "wiz init") ".")

   (title "Running a project")
   (p "There are ways to run a project:")
   (ul
    (li (b "wiz build") " - Building into html")
    (li (b "wiz live") " - Using a live view for development " (i "(requires npm & live-server)")))
   ))

(defn sp-hello []
  (main
   (title-main-sm "Hello view!")
   (p "Inside your newly created project,
       you should see a scheme script that looks like this at src/main.scm:")
   (script "(def init
  {})

(defn update [model action]
  model)

(defn view [model]
  (div \"hello\"))
")
   (p "What we will care about here is the view function at the bottom.")
   (p "This function returns the entire page.
       Every time there is an event, the page will be re-rendered
       and replaced by the output of this function.")

   (title "Writing HTML")
   (p "To write HTML inside of view, you have a handful set of functions
       name after most common HTML tags.
       Everything in them will become the contents inside of it.")

   (script
    "(p \"Hello\") ; => <p>Hello</p>
(p 5) ; => <p>5</p>
(div (h1 \"Hello\") (p \"subtitle\")) ; => <div><h1>Hello</h1><p>subtitle</p></div>
")
   (title "Adding classes")
   (p "You can modify the attributes of the tags by sending first
       a struct of their keys and values:")

   (script
    "(input {:type \"text\"
        :autofocus \"\"}) ; => <input type=text autofocus></input>")

   (title "Adding custom tags")
   (p "Some tags may not have their convenience functions,
       so you may have to use a list instead.")
   (script "[:p \"hello\"] ; => <p>hello</p>")

   (p "This works because tag functions are just a more convenient way
       of writing html arrays:")

   (script "(= [:p \"hello\"] (p \"hello\")) ; => true")
   ))

(def sidepages
  {:overview (sp-overview)
   :setup (sp-setup)
   :hello-view (sp-hello)
   :coming-soon (main (p "coming soon..."))
   })


; tea

(def init
  {:page :overview})

(defn update [model action]
  (print action)
  (case (action :type)
        :go-page (set model :page (action :value))
        model))

(defn view [model]
  (div
   {:class "p-4 max-w-220 mx-auto flex gap-4"}
   (div
    {:class "flex-[1] m-4"}
    ,(map
     (lambda [sidepage]
       (a
        {:href "/"
         :class (string "p-1 block w-full hover:text-bg hover:bg-fg cursor-pointer text-left"
                        (if (= (model :page) sidepage) "font-bold" "font-normal"))
         :on-click {:type :go-page
                    :value sidepage}}
        sidepage))
     (keys sidepages)
    ))
   (sidepages (model :page))))

(defn on-view [model]
  (prism/reload))
