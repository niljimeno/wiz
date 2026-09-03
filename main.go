package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"wiz/embed"
)

func main() {
	if len(os.Args) < 2 {
		displayHelp()
		return
	}

	switch os.Args[1] {
	default:
		displayHelp()

	case "init":
		var path string
		if len(os.Args) > 2 {
			path = os.Args[2]
			if path[len(path)-1] != '/' {
				path += "/"
			}
		}
		err := initialiseProject(path)
		if err != nil {
			fmt.Println(err)
		}

	case "build":
		err := buildProject()
		if err != nil {
			fmt.Println(err)
		}

	case "live":
		liveReload()
	}
}

func displayHelp() {
	fmt.Println(
		`Wiz - usage:
> wiz init :: initialise project
> wiz build :: compile project into target
> wiz live :: live reload project

Project structure:
- /src :: add your scheme and javascript modules there
- /style :: add your css files there. they will later be processed into a single style.css.
- /static :: where all your static content will go to (except css)`)
}

func copyFSFile(originalName, location string) error {
	fmt.Printf("Copying %s into %s\n", originalName, location)
	_, err := os.Stat(location)
	if err == nil {
		fmt.Printf("File %s exists, skipping.\n", location)
		return nil
	}

	contents, err := embed.FS.ReadFile(originalName)
	if err != nil {
		return err
	}

	os.WriteFile(location, contents, 0644)

	return nil
}

func copyDir(source, destination string) error {
	entries, err := os.ReadDir(source)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(destination, 0755); err != nil {
		return err
	}

	for _, entry := range entries {
		sourcePath := filepath.Join(source, entry.Name())
		destinationPath := filepath.Join(destination, entry.Name())
		if entry.IsDir() {
			if err := copyDir(sourcePath, destinationPath); err != nil {
				return err
			}
			continue
		}

		contents, err := os.ReadFile(sourcePath)
		if err != nil {
			return err
		}
		if err := os.WriteFile(destinationPath, contents, 0644); err != nil {
			return err
		}
	}

	return nil
}

func initialiseProject(path string) error {
	if path != "" {
		os.MkdirAll(path, 0755)
	}

	var err error
	os.Mkdir(path+"target", 0755)
	os.Mkdir(path+"internals", 0755)
	os.Mkdir(path+"src", 0755)
	os.Mkdir(path+"style", 0755)
	os.Mkdir(path+"static", 0755)

	err = copyFSFile("index.html", path+"internals/index.html")
	if err != nil {
		return err
	}

	err = copyFSFile("index.js", path+"internals/index.js")
	if err != nil {
		return err
	}

	err = copyFSFile("transform.js", path+"internals/transform.js")
	if err != nil {
		return err
	}

	err = copyFSFile("main.scm", path+"src/main.scm")
	if err != nil {
		return err
	}

	err = copyFSFile("style.css", path+"style/style.css")
	if err != nil {
		return err
	}

	copyFSFile("gitignore", path+".gitignore")

	fmt.Println("Created project")

	return nil
}

func buildProject() error {
	os.Mkdir("target", 0755)

	originalJs, err := os.ReadFile("internals/index.js")
	if err != nil {
		originalJs, err = embed.FS.ReadFile("index.js")
		if err != nil {
			return err
		}
	}

	finalJs := strings.Builder{}

	scheme, err := os.ReadFile("src/main.scm")
	if err != nil {
		return err
	}

	scheme = bytes.ReplaceAll(scheme, []byte("\\"), []byte("\\\\"))
	scheme = bytes.ReplaceAll(scheme, []byte("`"), []byte("\\`"))

	finalJs.WriteString("const code = ")
	finalJs.WriteString("`")

	finalJs.Write(scheme)

	finalJs.WriteString("`")
	finalJs.WriteString("\n\n")

	modules := map[string]string{}
	jsModules := map[string]string{}
	err = filepath.WalkDir(
		"src",
		func(path string, entry os.DirEntry, err error) error {
			if err != nil || entry.IsDir() || path == "src/main.scm" {
				return err
			}

			contents, readErr := os.ReadFile(path)
			if readErr != nil {
				return readErr
			}

			extension := filepath.Ext(path)
			switch extension {
			default:
				return err
			case ".scm", ".js":
			}

			name := strings.TrimSuffix(
				filepath.ToSlash(strings.TrimPrefix(path, "src/")),
				extension,
			)

			if extension == ".js" {
				jsModules[name] = path
			} else {
				modules[name] = string(contents)
			}
			return nil
		})

	if err != nil {
		return err
	}
	moduleData, err := json.Marshal(modules)
	if err != nil {
		return err
	}
	finalJs.WriteString("const modules = ")
	finalJs.Write(moduleData)
	finalJs.WriteString("\n\n")

	finalJs.WriteString("const jsModules = {}\n")
	for name, path := range jsModules {
		temp, err := os.CreateTemp("", "wiz-js-*.js")
		if err != nil {
			return err
		}
		tempName := temp.Name()
		if closeErr := temp.Close(); closeErr != nil {
			os.Remove(tempName)
			return closeErr
		}

		cmd := exec.Command("node", "internals/transform.js", path, tempName, name)
		if err := cmd.Run(); err != nil {
			os.Remove(tempName)
			return err
		}

		transformed, readErr := os.ReadFile(tempName)
		os.Remove(tempName)
		if readErr != nil {
			return readErr
		}
		finalJs.Write(transformed)
		key, _ := json.Marshal(name)
		finalJs.WriteString("jsModules[")
		finalJs.Write(key)
		finalJs.WriteString("] = ")
		finalJs.WriteString(name)
		finalJs.WriteString("\n")
		finalJs.WriteString("\n")
	}
	finalJs.WriteString("\n")

	finalJs.Write(originalJs)

	err = os.WriteFile("target/index.js", []byte(finalJs.String()), 0644)
	if err != nil {
		return err
	}

	finalCss := strings.Builder{}
	err = filepath.WalkDir("style", func(path string, entry os.DirEntry, err error) error {
		if err != nil || filepath.Ext(path) != ".css" {
			return err
		}
		contents, readErr := os.ReadFile(path)
		if readErr != nil {
			return readErr
		}

		finalCss.Write(contents)
		finalCss.WriteString("\n")
		return nil
	})
	if err != nil {
		return err
	}

	err = os.WriteFile("target/style.css", []byte(finalCss.String()), 0644)
	if err != nil {
		return err
	}

	cmd := exec.Command("postcss", "target/style.css", "--use", "postcss-nesting", "--output", "target/style.css")
	err = cmd.Run()
	if err != nil {
		fmt.Println("Error preprocessing css")
	}

	html, err := os.ReadFile("internals/index.html")
	if err != nil {
		html, err = embed.FS.ReadFile("index.html")
		if err != nil {
			return err
		}
	}

	err = os.WriteFile("target/index.html", html, 0644)
	if err != nil {
		return err
	}

	err = copyDir("static", "target/static")
	if err != nil {
		return err
	}

	return nil
}

func liveReload() {
	os.Mkdir("target", 0755)
	done := make(chan bool, 2)

	ctx, stop := signal.NotifyContext(
		context.Background(),
		os.Interrupt,
	)
	defer stop()

	args := [][]string{
		{"watchexec", "-e", "html,css,js,scm", "-i", "target/**", "wiz build"},
		{"live-server", "target", "--ignore=static/**"},
	}

	for _, arg := range args {
		cmd := exec.CommandContext(ctx, arg[0], arg[1:]...)
		cmd.Stdout, cmd.Stderr = os.Stdout, os.Stderr
		go func() {
			err := cmd.Run()
			if err != nil {
				fmt.Println("Error: -", err)
			}
			done <- true
		}()
	}

	for range len(args) {
		<-done
		stop()
	}
}
