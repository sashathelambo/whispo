import { Button } from "@renderer/components/ui/button"
import { Control, ControlGroup } from "@renderer/components/ui/control"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from "@renderer/components/ui/dialog"
import { Input } from "@renderer/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@renderer/components/ui/select"
import { Switch } from "@renderer/components/ui/switch"
import { Textarea } from "@renderer/components/ui/textarea"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@renderer/components/ui/tooltip"
import {
    useConfigQuery,
    useSaveConfigMutation,
} from "@renderer/lib/query-client"
import {
    APPLICATION_CONTEXTS,
    DEFAULT_CONTEXT_PROMPTS,
    getAvailableChatProviders,
    getAvailableSTTProviders,
    getHoldKeyDisplayName,
    HOLD_KEY_OPTIONS,
    SHORTCUT_OPTIONS
} from "@shared/index"
import { ApplicationContext, AppRule, Config } from "@shared/types"
import { useState } from "react"

export function Component() {
  const configQuery = useConfigQuery()
  const saveConfigMutation = useSaveConfigMutation()
  const [editingRule, setEditingRule] = useState<AppRule | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const saveConfig = (config: Partial<Config>) => {
    saveConfigMutation.mutate({
      config: {
        ...configQuery.data,
        ...config,
      },
    })
  }

  if (!configQuery.data) return null

  const config = configQuery.data
  const appRules = config.appRules || []
  const enableAppRules = config.enableAppRules ?? false

  const saveRule = (rule: AppRule) => {
    const existingRules = appRules.filter(r => r.id !== rule.id)
    const newRules = [...existingRules, rule].sort((a, b) => b.priority - a.priority)

    saveConfig({
      appRules: newRules,
    })
    setIsDialogOpen(false)
    setEditingRule(null)
  }

  const deleteRule = (ruleId: string) => {
    if (window.confirm("Delete this app rule?")) {
      saveConfig({
        appRules: appRules.filter(r => r.id !== ruleId),
      })
    }
  }

  const createNewRule = () => {
    const newRule: AppRule = {
      id: Date.now().toString(),
      appName: "",
      enabled: true,
      priority: 0,
    }
    setEditingRule(newRule)
    setIsDialogOpen(true)
  }

  const editRule = (rule: AppRule) => {
    setEditingRule({ ...rule })
    setIsDialogOpen(true)
  }

  const getShortcutDisplayText = (rule: AppRule) => {
    const shortcutOption = SHORTCUT_OPTIONS.find(opt => opt.value === rule.shortcut)
    if (rule.shortcut === "hold-key" && rule.holdKey) {
      const holdKeyOption = HOLD_KEY_OPTIONS.find(opt => opt.value === rule.holdKey)
      const displayName = holdKeyOption?.label || getHoldKeyDisplayName(rule.holdKey)
      return `${shortcutOption?.label} (${displayName})`
    }
    return shortcutOption?.label || "Default"
  }

  return (
    <div className="grid gap-4">
      <ControlGroup
        title="App-Specific Rules"
        endDescription="Configure different recording behaviors for specific applications. Higher priority rules take precedence."
      >
        <Control label="Enable App Rules" className="px-3">
          <Switch
            defaultChecked={enableAppRules}
            onCheckedChange={(value) => {
              saveConfig({
                enableAppRules: value,
              })
            }}
          />
        </Control>
      </ControlGroup>

      {enableAppRules && (
        <ControlGroup
          title={`Active Rules (${appRules.length})`}
          endDescription={
            <Button
              size="sm"
              variant="outline"
              className="h-6 gap-1 px-2"
              onClick={createNewRule}
            >
              <span className="i-mingcute-add-line"></span>
              Add Rule
            </Button>
          }
        >
          {appRules.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No app rules configured. Click "Add Rule" to create your first rule.
            </div>
          ) : (
            appRules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={(enabled) => {
                      saveRule({ ...rule, enabled })
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{rule.appName}</div>
                    <div className="text-xs text-muted-foreground">
                      {rule.executable && `${rule.executable} • `}
                      {getShortcutDisplayText(rule)} •
                      Priority {rule.priority}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => editRule(rule)}
                        >
                          <span className="i-mingcute-edit-2-line text-sm"></span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit rule</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-600"
                          onClick={() => deleteRule(rule.id)}
                        >
                          <span className="i-mingcute-delete-2-line text-sm"></span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete rule</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            ))
          )}
        </ControlGroup>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingRule?.appName ? `Edit Rule: ${editingRule.appName}` : "Create App Rule"}
            </DialogTitle>
          </DialogHeader>

          {editingRule && <AppRuleForm rule={editingRule} onSave={saveRule} config={config} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

const AppRuleForm = ({
  rule,
  onSave,
  config
}: {
  rule?: AppRule
  onSave: (rule: AppRule) => void
  config: Config
}) => {
  const [formData, setFormData] = useState<Partial<AppRule>>(rule || {
    appName: '',
    enabled: true,
    priority: 0,
  })

  const updateField = (field: keyof AppRule, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = () => {
    if (!formData.appName?.trim()) {
      alert("App name is required")
      return
    }

    // Ensure required fields have defaults
    const completeRule: AppRule = {
      id: formData.id || Date.now().toString(),
      appName: formData.appName,
      enabled: formData.enabled ?? true,
      priority: formData.priority ?? 0,
      ...formData
    }

    onSave(completeRule)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">App Name Pattern *</label>
          <Input
            placeholder="e.g., Code, Slack, Chrome"
            value={formData.appName}
            onChange={(e) => updateField('appName', e.target.value)}
          />
          <div className="text-xs text-muted-foreground mt-1">
            Window title pattern to match (case-insensitive)
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Executable (Optional)</label>
          <Input
            placeholder="e.g., code.exe, slack.exe"
            value={formData.executable || ""}
            onChange={(e) => updateField('executable', e.target.value)}
          />
          <div className="text-xs text-muted-foreground mt-1">
            Process executable name for precise matching
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium mb-2 block">Shortcut Behavior</label>
          <Select
            value={formData.shortcut || ""}
            onValueChange={(value) => updateField('shortcut', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Use default" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Use Default</SelectItem>
              {SHORTCUT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {formData.shortcut === "hold-key" && (
          <div>
            <label className="text-sm font-medium mb-2 block">Hold Key</label>
            <Select
              value={formData.holdKey || ""}
              onValueChange={(value) => updateField('holdKey', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Use default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Use Default</SelectItem>
                {HOLD_KEY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <label className="text-sm font-medium mb-2 block">STT Provider</label>
          <div className="space-y-2">
            <Select
              value={formData.sttProviderId || ""}
              onValueChange={(value) => updateField('sttProviderId', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Use default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Use Default</SelectItem>
                {getAvailableSTTProviders(config).map((provider) => (
                  <SelectItem key={provider.value} value={provider.value}>
                    <div className="flex items-center gap-2">
                      <span className="i-mingcute-check-circle-fill text-green-500 text-xs"></span>
                      {provider.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {getAvailableSTTProviders(config).length === 0 && (
              <div className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                <span className="i-mingcute-alert-circle-line"></span>
                No STT providers are enabled. Please configure providers first.
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Priority</label>
          <Input
            type="number"
            min="0"
            max="100"
            value={formData.priority}
            onChange={(e) => updateField('priority', parseInt(e.target.value) || 0)}
          />
          <div className="text-xs text-muted-foreground mt-1">
            Higher numbers = higher priority
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Auto-Insert Transcript</label>
          <Switch
            checked={formData.autoInsert || false}
            onCheckedChange={(value) => updateField('autoInsert', value)}
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Enable Post-Processing</label>
          <Switch
            checked={formData.transcriptPostProcessingEnabled || false}
            onCheckedChange={(value) => updateField('transcriptPostProcessingEnabled', value)}
          />
        </div>

        {formData.transcriptPostProcessingEnabled && (
          <>
            <div>
              <label className="text-sm font-medium mb-2 block">Processing Provider</label>
              <div className="space-y-2">
                <Select
                  value={formData.transcriptPostProcessingProviderId || ""}
                  onValueChange={(value) => updateField('transcriptPostProcessingProviderId', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Use default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Use Default</SelectItem>
                    {getAvailableChatProviders(config).map((provider) => (
                      <SelectItem key={provider.value} value={provider.value}>
                        <div className="flex items-center gap-2">
                          <span className="i-mingcute-check-circle-fill text-green-500 text-xs"></span>
                          {provider.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {getAvailableChatProviders(config).length === 0 && (
                  <div className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                    <span className="i-mingcute-alert-circle-line"></span>
                    No Chat providers are enabled. Please configure providers first.
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Custom Prompt</label>
              <Textarea
                rows={4}
                placeholder="Leave empty to use default prompt..."
                value={formData.transcriptPostProcessingPrompt || ""}
                onChange={(e) => updateField('transcriptPostProcessingPrompt', e.target.value)}
              />
              <div className="text-xs text-muted-foreground mt-1">
                Use <span className="select-text">{"{transcript}"}</span> placeholder for the original transcript
              </div>
            </div>
          </>
        )}

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Enable Context Formatting</label>
          <Switch
            checked={formData.contextFormatting?.enabled || false}
            onCheckedChange={(value) => updateField('contextFormatting', {
              ...formData.contextFormatting,
              enabled: value
            })}
          />
        </div>

        {formData.contextFormatting?.enabled && (
          <>
            <div>
              <label className="text-sm font-medium mb-2 block">Context Type</label>
              <Select
                value={formData.contextFormatting?.context || ""}
                onValueChange={(value) => updateField('contextFormatting', {
                  ...formData.contextFormatting,
                  context: value as ApplicationContext,
                  prompt: DEFAULT_CONTEXT_PROMPTS[value as ApplicationContext] || ""
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select context type" />
                </SelectTrigger>
                <SelectContent>
                  {APPLICATION_CONTEXTS.map((context) => (
                    <SelectItem key={context.value} value={context.value}>
                      {context.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground mt-1">
                The context type determines how text will be formatted
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Custom Formatting Prompt</label>
              <Textarea
                rows={3}
                placeholder="Leave empty to use default context prompt..."
                value={formData.contextFormatting?.prompt || ""}
                onChange={(e) => updateField('contextFormatting', {
                  ...formData.contextFormatting,
                  prompt: e.target.value
                })}
              />
              <div className="text-xs text-muted-foreground mt-1">
                Use <span className="select-text">{"{transcript}"}</span> placeholder for the original transcript
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center justify-between">
                <label className="text-sm">Code Formatting</label>
                <Switch
                  checked={formData.contextFormatting?.enableCodeFormatting || false}
                  onCheckedChange={(value) => updateField('contextFormatting', {
                    ...formData.contextFormatting,
                    enableCodeFormatting: value
                  })}
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm">List Formatting</label>
                <Switch
                  checked={formData.contextFormatting?.enableListFormatting || false}
                  onCheckedChange={(value) => updateField('contextFormatting', {
                    ...formData.contextFormatting,
                    enableListFormatting: value
                  })}
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm">Professional Tone</label>
                <Switch
                  checked={formData.contextFormatting?.enableProfessionalTone || false}
                  onCheckedChange={(value) => updateField('contextFormatting', {
                    ...formData.contextFormatting,
                    enableProfessionalTone: value
                  })}
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-sm">Technical Terms</label>
                <Switch
                  checked={formData.contextFormatting?.enableTechnicalTerms || false}
                  onCheckedChange={(value) => updateField('contextFormatting', {
                    ...formData.contextFormatting,
                    enableTechnicalTerms: value
                  })}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Custom Instructions</label>
              <Input
                placeholder="e.g., Always use semicolons, format as bullet points..."
                value={formData.contextFormatting?.customInstructions || ""}
                onChange={(e) => updateField('contextFormatting', {
                  ...formData.contextFormatting,
                  customInstructions: e.target.value
                })}
              />
              <div className="text-xs text-muted-foreground mt-1">
                Additional formatting instructions for this specific app
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={() => setFormData(rule || {})}>
          Reset
        </Button>
        <Button onClick={handleSave}>
          Save Rule
        </Button>
      </div>
    </div>
  )
}
