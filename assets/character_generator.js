const formContainer = document.getElementById("form-container");
const gameSelect = document.getElementById("game-select");

let fieldPathMap = {}; // Maps input names to output path arrays

gameSelect.addEventListener("change", async () => {
    const game = gameSelect.value;
    formContainer.innerHTML = "";
    fieldPathMap = {};

    if (!game) return;

    const basePath = window.location.pathname.split("/").slice(0, 2).join("/");
    const res = await fetch(`${basePath}/data/${game}.json`);
    const schema = await res.json();
    window.lastLoadedSchema = schema;

    const form = document.createElement("form");
    form.id = `${game}-form`;

    schema.groups.forEach(group => {
        const section = document.createElement("fieldset");
        section.classList.add("mb-6", "border", "border-[#444]", "rounded");

        const legend = document.createElement("legend");
        legend.classList.add("flex", "items-center", "justify-between", "cursor-pointer", "bg-[#2a2a2a]", "text-parchment", "font-semibold", "px-4", "py-2", "rounded-t");
        legend.innerHTML = `<span>${group.title}</span><span class="toggle-arrow">▾</span>`;

        const contentDiv = document.createElement("div");
        contentDiv.style.display = "block";
        contentDiv.classList.add("p-4", "group-content");

        group.fields.forEach(field => {
            if (field.type === "group" && Array.isArray(field.children)) {
                const subgroup = document.createElement("fieldset");
                subgroup.classList.add("border", "border-[#333]", "bg-[#1a1a1a]", "mb-4", "rounded");

                const sublegend = document.createElement("legend");
                sublegend.classList.add("flex", "items-center", "justify-between", "cursor-pointer", "bg-[#2a2a2a]", "text-[#aaa]", "px-3", "py-1", "rounded-t", "text-sm");
                sublegend.innerHTML = `<span>${field.label}</span><span class="toggle-arrow">▾</span>`;

                const subContent = document.createElement("div");
                subContent.style.display = "none";
                subContent.classList.add("p-3");

                field.children.forEach(child => {
                    const wrapper = document.createElement("div");
                    wrapper.classList.add("mb-2");

                    const label = document.createElement("label");
                    label.textContent = child.label + ": ";
                    label.classList.add("block", "text-sm", "mb-1");

                    const input = document.createElement("input");
                    const inputName = `${field.name}_${child.name}`;
                    input.name = inputName;
                    input.type = child.type || "text";
                    input.classList.add("bg-[#2a2a2a]", "text-parchment", "px-2", "py-1", "w-full");

                    fieldPathMap[inputName] = ["Skills", field.label, child.label];

                    wrapper.appendChild(label);
                    wrapper.appendChild(input);
                    subContent.appendChild(wrapper);
                });

                sublegend.addEventListener("click", () => {
                    const arrow = sublegend.querySelector(".toggle-arrow");
                    const isHidden = subContent.style.display === "none";
                    subContent.style.display = isHidden ? "block" : "none";
                    arrow.textContent = isHidden ? "▾" : "▸";
                });

                subgroup.appendChild(sublegend);
                subgroup.appendChild(subContent);
                contentDiv.appendChild(subgroup);
            } else {
                const wrapper = document.createElement("div");
                wrapper.classList.add("mb-2");

                const label = document.createElement("label");
                label.textContent = field.label + ": ";
                label.classList.add("block", "text-sm", "mb-1");

                const input = document.createElement("input");
                input.name = field.name;
                input.type = field.type || "text";
                input.classList.add("bg-[#2a2a2a]", "text-parchment", "px-2", "py-1", "w-full");

                // Map to root-level path using label as key
                fieldPathMap[field.name] = [field.label];

                wrapper.appendChild(label);
                wrapper.appendChild(input);
                contentDiv.appendChild(wrapper);
            }
        });

        legend.addEventListener("click", () => {
            const arrow = legend.querySelector(".toggle-arrow");
            const isHidden = contentDiv.style.display === "none";
            contentDiv.style.display = isHidden ? "block" : "none";
            arrow.textContent = isHidden ? "▾" : "▸";
        });

        section.appendChild(legend);
        section.appendChild(contentDiv);
        form.appendChild(section);
    });

    formContainer.appendChild(form);
    document.getElementById("result-download").classList.remove("hidden");
});

function setNestedValue(obj, path, value) {
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
        const step = path[i];
        if (!(step in current)) current[step] = {};
        current = current[step];
    }
    current[path[path.length - 1]] = value;
}

window.generateJSON = function () {
    const game = gameSelect.value;
    const form = document.querySelector(`#${game}-form`);
    const formData = new FormData(form);
    const flat = Object.fromEntries(formData.entries());
    const out = {};
    const checkboxFields = new Set();
    const fieldPathMap = {};

    function parseValue(val, type) {
        if (type === "checkbox") return !!val;
        if (type === "number") return parseInt(val, 10);
        return val;
    }

    function setNested(obj, path, value) {
        let current = obj;
        for (let i = 0; i < path.length - 1; i++) {
            if (!current[path[i]]) current[path[i]] = {};
            current = current[path[i]];
        }
        current[path[path.length - 1]] = value;
    }

    const schema = window.lastLoadedSchema;
    if (!schema) {
        alert("Schema not loaded. Cannot generate output.");
        return;
    }

    schema.groups.forEach(group => {
        const top = group.title === "Basic Info" ? null : group.title;

        group.fields.forEach(field => {
            if (field.type === "group" && Array.isArray(field.children)) {
                const subgroup = field.label;

                field.children.forEach(child => {
                    const key = `${field.name}_${child.name}`;
                    const path = top ? [top, subgroup, child.label] : [subgroup, child.label];
                    fieldPathMap[key] = path;

                    if (child.type === "checkbox") checkboxFields.add(key);
                    const val = flat[key];
                    if (val !== undefined) {
                        const parsed = parseValue(val, child.type);
                        setNested(out, path, parsed);
                    }
                });

            } else {
                const key = field.name;
                const path = top ? [top, field.label] : [field.label];
                fieldPathMap[key] = path;

                if (field.type === "checkbox") checkboxFields.add(key);
                const val = flat[key];
                if (val !== undefined) {
                    const parsed = parseValue(val, field.type);
                    setNested(out, path, parsed);
                }
            }
        });
    });

    // Backfill missing checkboxes with false
    for (const name of checkboxFields) {
        if (!(name in flat)) {
            const path = fieldPathMap[name];
            if (path) {
                setNested(out, path, false);
            }
        }
    }

    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${flat.name || "character"}.json`;
    a.click();
};
